import { analyzePortfolio } from '@/lib/services/portfolio-analysis';
import { getPortfolioPositions } from '@/lib/services/position';
import { listRecentAIInsights } from '@/lib/services/ai-advisor';
import { getSmartAlerts } from '@/lib/server/smartAlerts';
import {
  getPersonalizationSettings,
  updatePersonalizationSettings,
} from '@/lib/server/personalizationSettings';
import type {
  MarketMode,
  PersonalizedAction,
  PersonalizedDashboardResponse,
  PersonalizedHeroMetric,
  PersonalizedMetric,
  RiskProfile,
} from '@/types';

function determineMarketMode(returnRate: number): MarketMode {
  if (!Number.isFinite(returnRate)) {
    return 'neutral';
  }
  if (returnRate >= 5) {
    return 'bullish';
  }
  if (returnRate <= -5) {
    return 'bearish';
  }
  return 'neutral';
}

function pickRiskLabel(riskProfile: RiskProfile): string {
  switch (riskProfile) {
    case 'conservative':
      return '보수적';
    case 'aggressive':
      return '공격적';
    default:
      return '균형형';
  }
}

function formatHeroMetrics(params: {
  totalValue: number;
  totalInvested: number;
  returnRate: number;
  baseCurrency: 'USD' | 'KRW';
}): PersonalizedHeroMetric[] {
  const { totalValue, totalInvested, returnRate, baseCurrency } = params;
  const invested = Number.isFinite(totalInvested) ? totalInvested : 0;
  const gainLoss = Number.isFinite(totalValue - invested) ? totalValue - invested : 0;

  return [
    {
      id: 'total-value',
      label: '총 평가액',
      value: totalValue,
      type: 'currency',
      currency: baseCurrency,
      change: gainLoss,
    },
    {
      id: 'overall-return',
      label: '누적 수익률',
      value: returnRate,
      type: 'percent',
      change: null,
    },
  ];
}

function buildRiskMetrics(params: {
  riskProfile: RiskProfile;
  baseCurrency: 'USD' | 'KRW';
  returnRate: number;
  volatility?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  diversificationScore?: number;
  topContributors?: Array<{ symbol: string; returnRate: number; contribution: number }>;
}): PersonalizedMetric[] {
  const {
    riskProfile,
    baseCurrency,
    returnRate,
    volatility,
    maxDrawdown,
    sharpeRatio,
    diversificationScore,
    topContributors,
  } = params;

  const commonMetrics: PersonalizedMetric[] = [
    {
      id: 'overall-return',
      label: '누적 수익률',
      value: returnRate,
      type: 'percent',
      emphasis: returnRate >= 0 ? 'positive' : 'negative',
    },
  ];

  if (riskProfile === 'conservative') {
    commonMetrics.push(
      {
        id: 'volatility',
        label: '변동성',
        value: volatility ?? 0,
        type: 'percent',
        description: '최근 1년간 포트폴리오 변동성',
        emphasis: 'neutral',
      },
      {
        id: 'max-drawdown',
        label: '최대 낙폭',
        value: maxDrawdown ?? 0,
        type: 'percent',
        description: '포트폴리오 최대 하락 폭',
        emphasis: 'negative',
      },
      {
        id: 'diversification',
        label: '분산 점수',
        value: diversificationScore ?? 0,
        type: 'score',
        description: '섹터/지역/자산 분산 점수',
        emphasis: 'neutral',
      }
    );
  } else if (riskProfile === 'aggressive') {
    const topPerformer = topContributors?.[0];
    commonMetrics.push(
      {
        id: 'top-performer',
        label: topPerformer?.symbol ? `${topPerformer.symbol} 수익률` : '최고 수익 종목',
        value: topPerformer?.returnRate ?? 0,
        type: 'percent',
        emphasis: (topPerformer?.returnRate ?? 0) >= 0 ? 'positive' : 'negative',
        description: '포트폴리오 기여도가 가장 높은 종목',
      },
      {
        id: 'volatility',
        label: '변동성',
        value: volatility ?? 0,
        type: 'percent',
        description: '공격적 투자자는 높은 변동성 감내 필요',
        emphasis: 'neutral',
      },
      {
        id: 'diversification',
        label: '분산 점수',
        value: diversificationScore ?? 0,
        type: 'score',
        description: '집중도를 관리해 리스크를 줄이세요.',
        emphasis: 'neutral',
      }
    );
  } else {
    commonMetrics.push(
      {
        id: 'sharpe-ratio',
        label: '샤프 비율',
        value: sharpeRatio ?? 0,
        type: 'score',
        description: '위험 대비 수익 효율',
        emphasis: 'neutral',
      },
      {
        id: 'volatility',
        label: '변동성',
        value: volatility ?? 0,
        type: 'percent',
        description: '포트폴리오 위험 수준',
        emphasis: 'neutral',
      },
      {
        id: 'diversification',
        label: '분산 점수',
        value: diversificationScore ?? 0,
        type: 'score',
        description: '균형 잡힌 자산 배분 지표',
        emphasis: 'neutral',
      }
    );
  }

  return commonMetrics;
}

function buildActions(params: {
  alerts: ReturnType<typeof getSmartAlerts>;
  riskProfile: RiskProfile;
  latestInsight?: Awaited<ReturnType<typeof listRecentAIInsights>>[number];
}): PersonalizedAction[] {
  const { alerts, riskProfile, latestInsight } = params;
  const actionItems: PersonalizedAction[] = [];

  alerts.alerts.slice(0, 3).forEach((alert) => {
    actionItems.push({
      id: `alert-${alert.id}`,
      title: alert.title,
      summary: alert.description,
      severity: alert.severity,
      source: 'alert',
      createdAt: alert.createdAt,
      relatedSymbol: alert.symbol,
    });
  });

  const insight = latestInsight;
  if (insight?.actionItems?.length) {
    const primary = insight.actionItems[0];
    actionItems.unshift({
      id: insight.id ?? `ai-${primary.id}`,
      title: primary.title,
      summary: primary.summary,
      severity: riskProfile === 'aggressive' ? 'important' : 'info',
      source: 'ai',
      createdAt: insight.generatedAt?.toDate
        ? insight.generatedAt.toDate().toISOString()
        : new Date().toISOString(),
      relatedSymbol: primary.relatedTickers?.[0],
    });
  }

  return actionItems.slice(0, 5);
}

function recommendWidgets(riskProfile: RiskProfile): string[] {
  switch (riskProfile) {
    case 'conservative':
      return ['smart-alerts', 'benchmark-comparison', 'period-performance', 'rebalancing'];
    case 'aggressive':
      return ['ai-advisor', 'stock-comparison', 'smart-alerts', 'rebalancing'];
    default:
      return ['smart-alerts', 'period-performance', 'contribution-breakdown', 'ai-advisor'];
  }
}

function deriveMood(marketMode: MarketMode): 'positive' | 'negative' | 'neutral' {
  if (marketMode === 'bullish') {
    return 'positive';
  }
  if (marketMode === 'bearish') {
    return 'negative';
  }
  return 'neutral';
}

export async function buildPersonalizedDashboard(params: {
  userId: string;
  portfolioId: string;
}): Promise<PersonalizedDashboardResponse> {
  const { userId, portfolioId } = params;

  const [settings, analysis, positions, alerts, insights] = await Promise.all([
    getPersonalizationSettings(userId),
    analyzePortfolio(userId, portfolioId),
    getPortfolioPositions(userId, portfolioId),
    getSmartAlerts({ userId, portfolioId }),
    listRecentAIInsights(1).catch(() => []),
  ]);

  const [latestInsight] = insights;

  const marketMode = determineMarketMode(analysis.overallReturnRate);
  const heroMetrics = formatHeroMetrics({
    totalValue: analysis.totalValue,
    totalInvested: analysis.totalInvested,
    returnRate: analysis.overallReturnRate,
    baseCurrency: analysis.baseCurrency,
  });

  const riskLabel = pickRiskLabel(settings.riskProfile);
  const heroHeadline = `${riskLabel} 전략으로 ${marketMode === 'bullish' ? '수익 모멘텀 유지 중' : marketMode === 'bearish' ? '리스크 관리가 필요합니다' : '균형 잡힌 상태를 유지 중입니다'}`;
  const heroSubheading =
    marketMode === 'bullish'
      ? '추가 수익 기회를 활용하고 비중을 최적화하세요.'
      : marketMode === 'bearish'
      ? '방어적인 자산과 현금 비중을 점검해 손실을 제한하세요.'
      : '시장 변동성에 대비해 핵심 지표를 모니터링하세요.';

  const metrics = buildRiskMetrics({
    riskProfile: settings.riskProfile,
    baseCurrency: analysis.baseCurrency,
    returnRate: analysis.overallReturnRate,
    volatility: analysis.riskMetrics?.volatility,
    maxDrawdown: analysis.riskMetrics?.maxDrawdown,
    sharpeRatio: analysis.riskMetrics?.sharpeRatio,
    diversificationScore: analysis.diversificationScore,
    topContributors: analysis.topContributors,
  });

  const actions = buildActions({
    alerts,
    riskProfile: settings.riskProfile,
    latestInsight,
  });

  return {
    success: true,
    settings,
    marketMode,
    baseCurrency: analysis.baseCurrency,
    hero: {
      headline: heroHeadline,
      subheading: heroSubheading,
      mood: deriveMood(marketMode),
      metrics: heroMetrics,
    },
    metrics,
    actions,
    recommendedWidgets: recommendWidgets(settings.riskProfile),
    updatedAt: new Date().toISOString(),
  };
}

export async function saveRiskProfile(userId: string, riskProfile: RiskProfile) {
  return updatePersonalizationSettings(userId, { riskProfile });
}

