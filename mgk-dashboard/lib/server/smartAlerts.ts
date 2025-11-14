import { randomUUID } from 'crypto';

import { analyzePortfolio } from '@/lib/services/portfolio-analysis';
import { generateRebalancingSuggestions } from '@/lib/services/portfolio-analysis';
import { getPortfolioPositions } from '@/lib/services/position';
import { listRecentAIInsights } from '@/lib/services/ai-advisor';
import type {
  Position,
  SmartAlert,
  SmartAlertResponse,
  SmartAlertSeverity,
} from '@/types';

function createAlert(params: {
  severity: SmartAlertSeverity;
  title: string;
  description: string;
  symbol?: string;
  tags?: string[];
  recommendedAction?: string;
  data?: Record<string, unknown>;
}): SmartAlert {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    severity: params.severity,
    title: params.title,
    description: params.description,
    symbol: params.symbol,
    tags: params.tags,
    recommendedAction: params.recommendedAction,
    data: params.data,
  };
}

function evaluateEmergencyAlerts(positions: Position[]): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  positions.forEach((position) => {
    if (!Number.isFinite(position.returnRate)) {
      return;
    }
    const returnRate = position.returnRate;

    if (returnRate <= -5) {
      alerts.push(
        createAlert({
          severity: 'emergency',
          title: `${position.symbol} 급락 경보`,
          description: `${position.symbol}이 ${returnRate.toFixed(2)}% 하락했습니다. 손절 전략을 검토하세요.`,
          symbol: position.symbol,
          tags: ['price-drop'],
          recommendedAction: '손절 라인 점검 및 추가 하락 대비',
          data: {
            returnRate,
            totalValue: position.totalValue,
          },
        })
      );
    } else if (returnRate >= 5) {
      alerts.push(
        createAlert({
          severity: 'emergency',
          title: `${position.symbol} 급등 알림`,
          description: `${position.symbol}이 ${returnRate.toFixed(2)}% 상승했습니다. 목표 수익 실현 여부를 검토하세요.`,
          symbol: position.symbol,
          tags: ['price-surge'],
          recommendedAction: '익절 또는 비중 조정 검토',
          data: {
            returnRate,
            totalValue: position.totalValue,
          },
        })
      );
    }

    if (position.sellAlert?.enabled && Number.isFinite(position.sellAlert.targetReturnRate)) {
      const target = position.sellAlert.targetReturnRate;
      if (returnRate >= target) {
        alerts.push(
          createAlert({
            severity: 'emergency',
            title: `${position.symbol} 목표 수익률 도달`,
            description: `${position.symbol}이 목표 수익률 ${target.toFixed(2)}%에 도달했습니다.`,
            symbol: position.symbol,
            tags: ['target-hit'],
            recommendedAction: '익절 실행 또는 목표 재설정',
            data: { returnRate, target },
          })
        );
      } else if (position.sellAlert.triggerOnce && returnRate <= -Math.abs(target)) {
        alerts.push(
          createAlert({
            severity: 'emergency',
            title: `${position.symbol} 손절 라인 접근`,
            description: `${position.symbol}이 손절 한계치에 근접했습니다. 방어 전략을 준비하세요.`,
            symbol: position.symbol,
            tags: ['stop-loss'],
            recommendedAction: '손절 실행 또는 비중 축소 검토',
            data: { returnRate, target },
          })
        );
      }
    }
  });

  return alerts;
}

function evaluateImportantAlerts(params: {
  positions: Position[];
  rebalancing: ReturnType<typeof generateRebalancingSuggestions>;
  riskMetrics: Record<string, number>;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const { positions, rebalancing, riskMetrics } = params;

  if (rebalancing.length) {
    const topSuggestions = rebalancing.slice(0, 3);
    const symbols = topSuggestions.map((item) => item.symbol).join(', ');

    alerts.push(
      createAlert({
        severity: 'important',
        title: '리밸런싱 권장',
        description: `비중 조정이 필요한 종목: ${symbols}`,
        tags: ['rebalancing'],
        recommendedAction: '리밸런싱 시뮬레이터를 실행하여 권장 비중을 확인하세요.',
        data: {
          suggestions: topSuggestions,
        },
      })
    );
  }

  if (Number.isFinite(riskMetrics?.volatility) && riskMetrics.volatility > 25) {
    alerts.push(
      createAlert({
        severity: 'important',
        title: '포트폴리오 변동성 증가',
        description: `최근 변동성이 ${riskMetrics.volatility.toFixed(
          2
        )}%로 높습니다. 방어형 자산 비중을 고려하세요.`,
        tags: ['risk'],
        recommendedAction: '섹터 및 지역 분산을 재점검하세요.',
        data: {
          volatility: riskMetrics.volatility,
          sharpeRatio: riskMetrics.sharpeRatio,
        },
      })
    );
  }

  const totalValue = positions.reduce((sum, item) => sum + Math.max(0, item.totalValue), 0);
  const highlyConcentrated =
    totalValue > 0
      ? positions
          .filter((position) => position.totalValue > 0)
          .filter((position) => position.totalValue / totalValue >= 0.25)
      : [];

  if (highlyConcentrated.length) {
    alerts.push(
      createAlert({
        severity: 'important',
        title: '집중 위험 감지',
        description: `${highlyConcentrated
          .map((item) => item.symbol)
          .join(', ')} 비중이 높습니다. 분산 투자를 검토하세요.`,
        tags: ['concentration'],
        recommendedAction: '비중이 높은 종목을 일부 매도하거나 다른 자산군을 편입하세요.',
        data: {
          concentratedSymbols: highlyConcentrated.map((item) => ({
            symbol: item.symbol,
            returnRate: item.returnRate,
            totalValue: item.totalValue,
          })),
        },
      })
    );
  }

  return alerts;
}

function evaluateInfoAlerts(params: {
  portfolioReturnRate: number;
  aiActionSummary?: string;
  latestInsightId?: string;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const { portfolioReturnRate, aiActionSummary, latestInsightId } = params;

  alerts.push(
    createAlert({
      severity: 'info',
      title: '주간 성과 요약',
      description: `현재 포트폴리오 수익률은 ${portfolioReturnRate.toFixed(2)}% 입니다.`,
      tags: ['performance'],
    })
  );

  if (aiActionSummary) {
    alerts.push(
      createAlert({
        severity: 'important',
        title: 'AI 추천 액션',
        description: aiActionSummary,
        tags: ['ai-action'],
        recommendedAction: 'AI 어드바이저 카드에서 상세 단계를 확인하세요.',
        data: { insightId: latestInsightId },
      })
    );
  }

  return alerts;
}

export async function getSmartAlerts(params: {
  userId: string;
  portfolioId: string;
}): Promise<SmartAlertResponse> {
  const { userId, portfolioId } = params;
  const positions = await getPortfolioPositions(userId, portfolioId);
  const analysis = await analyzePortfolio(userId, portfolioId);
  const insights = await listRecentAIInsights(1);
  const [latestInsight] = insights;

  const rebalancing = generateRebalancingSuggestions(positions, {
    targetAllocation: undefined,
    baseTotalValue: analysis.totalValue,
    exchangeRate: analysis.exchangeRate?.rate ?? null,
  });

  const alerts: SmartAlert[] = [
    ...evaluateEmergencyAlerts(positions),
    ...evaluateImportantAlerts({
      positions,
      rebalancing,
      riskMetrics: analysis.riskMetrics ?? {},
    }),
    ...evaluateInfoAlerts({
      portfolioReturnRate: analysis.overallReturnRate,
      aiActionSummary: latestInsight?.actionItems?.length
        ? `${latestInsight.actionItems[0].title} 외 ${
            Math.max(0, latestInsight.actionItems.length - 1)
          }건의 실행 아이템`
        : undefined,
      latestInsightId: latestInsight?.id,
    }),
  ];

  const counts: Record<SmartAlertSeverity, number> = {
    emergency: alerts.filter((alert) => alert.severity === 'emergency').length,
    important: alerts.filter((alert) => alert.severity === 'important').length,
    info: alerts.filter((alert) => alert.severity === 'info').length,
  };

  return {
    success: true,
    baseCurrency: analysis.baseCurrency,
    alerts: alerts.sort((a, b) => {
      const severityWeight: Record<SmartAlertSeverity, number> = {
        emergency: 0,
        important: 1,
        info: 2,
      };
      const diff = severityWeight[a.severity] - severityWeight[b.severity];
      if (diff !== 0) {
        return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    generatedAt: new Date().toISOString(),
    meta: {
      counts,
    },
  };
}

