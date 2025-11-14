import { Timestamp, limit, orderBy } from 'firebase/firestore';

import {
  addDocument,
  getDocumentsByDateRange,
  getDocumentsSince,
  getDocumentsWithLimit,
  getDocument,
  queryCollection,
  updateDocument,
} from '@/lib/firestore';
import { buildPeriodRange } from '@/lib/utils';
import { getPortfolioPositions } from './position';
import { analyzePortfolio } from './portfolio-analysis';
import type {
  AIAdvisorContext,
  AIAdvisorPromptPayload,
  AIAdvisorRecommendation,
  AIAdvisorResult,
  AIAdvisorSignal,
  AIInsight,
  AppSettings,
  DailyPurchase,
  DashboardStats,
  NewsItem,
  WeeklyReportWithAI,
  Position,
} from '@/types';
import type { PortfolioAnalysis } from './portfolio-analysis';
import { formatPercent } from '@/lib/utils/formatters';
import type { PersonalizedNews } from './news-analysis';

const DEFAULT_PERIOD_DAYS = Number(process.env.AI_ADVISOR_DEFAULT_PERIOD ?? 7);
const DEFAULT_MODEL = process.env.GPT_OSS_MODEL ?? 'gpt-oss-20b';
const DEFAULT_ENDPOINT =
  process.env.GPT_OSS_ENDPOINT ?? 'https://api.gpt-oss.wiz.ai/v1/chat/completions';

interface FetchContextOptions {
  periodDays?: number;
  tickers?: string[];
}

interface CallAIAdvisorOptions {
  model?: string;
  endpoint?: string;
  temperature?: number;
}

interface StoreInsightOptions {
  model?: string;
  periodLabel?: string;
  sourceReportId?: string;
}

const toISOString = (value: unknown) => {
  if (!value) return undefined;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
};

const validActions = new Set(['buy', 'sell', 'hold']);
const validPriorities = new Set(['high', 'medium', 'low']);
const validUrgency = new Set(['today', 'this_week', 'this_month', 'long_term']);
const validEffort = new Set(['low', 'medium', 'high']);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 32) || 'action';

function normalizeRecommendations(value: unknown): AIAdvisorRecommendation[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) {
      return [
        {
          ticker: 'PORTFOLIO',
          action: 'hold',
          reason: value.trim(),
        },
      ];
    }
    return [];
  }

  return value
    .map((item): AIAdvisorRecommendation | null => {
      if (typeof item === 'string') {
        return {
          ticker: 'PORTFOLIO',
          action: 'hold',
          reason: item,
        };
      }

      if (item && typeof item === 'object') {
        const ticker = typeof (item as any).ticker === 'string' && (item as any).ticker.trim()
          ? (item as any).ticker.trim()
          : 'PORTFOLIO';
        const actionRaw = typeof (item as any).action === 'string' ? (item as any).action.toLowerCase() : 'hold';
        const action = validActions.has(actionRaw) ? (actionRaw as 'buy' | 'sell' | 'hold') : 'hold';
        const reason = typeof (item as any).reason === 'string' && (item as any).reason.trim()
          ? (item as any).reason.trim()
          : '';
        const confidence = typeof (item as any).confidence === 'number' ? (item as any).confidence : undefined;

        return {
          ticker,
          action,
          reason: reason || '근거가 제공되지 않았습니다.',
          confidence,
        };
      }

      return null;
    })
    .filter((rec): rec is AIAdvisorRecommendation => rec !== null);
}

function normalizeSignals(value: unknown): AIAdvisorSignal {
  if (value && typeof value === 'object') {
    const sellSignal = typeof (value as any).sellSignal === 'boolean' ? (value as any).sellSignal : false;
    const reason = typeof (value as any).reason === 'string' ? (value as any).reason : '';
    const notes = Array.isArray((value as any).notes)
      ? (value as any).notes.filter((note: unknown): note is string => typeof note === 'string')
      : undefined;

    return {
      sellSignal,
      reason,
      ...(notes && notes.length > 0 ? { notes } : {}),
    };
  }

  return {
    sellSignal: false,
    reason: '',
  };
}

function normalizeActionItems(value: unknown): AIAdvisorActionItem[] {
  if (!value) {
    return [];
  }

  const items = Array.isArray(value) ? value : [value];

  return items
    .map((item, index): AIAdvisorActionItem | null => {
      if (typeof item === 'string' && item.trim()) {
        const title = item.trim();
        return {
          id: `${slugify(title)}-${index}`,
          title,
          summary: title,
          priority: 'medium',
          urgency: 'this_week',
          impact: 'return',
          relatedTickers: [],
          steps: [],
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const raw = item as Record<string, unknown>;
      const title =
        typeof raw.title === 'string' && raw.title.trim()
          ? raw.title.trim()
          : typeof raw.summary === 'string' && raw.summary.trim()
          ? raw.summary.trim()
          : 'Action Item';
      const summary =
        typeof raw.summary === 'string' && raw.summary.trim()
          ? raw.summary.trim()
          : typeof raw.description === 'string' && raw.description.trim()
          ? raw.description.trim()
          : title;
      const priorityRaw =
        typeof raw.priority === 'string' && raw.priority.trim()
          ? raw.priority.trim().toLowerCase()
          : 'medium';
      const priority = validPriorities.has(priorityRaw)
        ? (priorityRaw as AIAdvisorActionItem['priority'])
        : 'medium';
      const urgencyRaw =
        typeof raw.urgency === 'string' && raw.urgency.trim()
          ? raw.urgency.trim().toLowerCase()
          : 'this_week';
      const urgency = validUrgency.has(urgencyRaw)
        ? (urgencyRaw as AIAdvisorActionItem['urgency'])
        : 'this_week';
      const impact =
        typeof raw.impact === 'string' && raw.impact.trim()
          ? raw.impact.trim().toLowerCase()
          : 'return';
      const relatedTickers = Array.isArray(raw.relatedTickers)
        ? raw.relatedTickers
            .filter((ticker): ticker is string => typeof ticker === 'string' && ticker.trim())
            .map((ticker) => ticker.trim().toUpperCase())
        : undefined;
      const dueDate =
        typeof raw.dueDate === 'string' && raw.dueDate.trim()
          ? raw.dueDate.trim()
          : typeof raw.due === 'string' && raw.due.trim()
          ? raw.due.trim()
          : undefined;
      const estimatedEffortRaw =
        typeof raw.estimatedEffort === 'string' && raw.estimatedEffort.trim()
          ? raw.estimatedEffort.trim().toLowerCase()
          : undefined;
      const estimatedEffort = estimatedEffortRaw && validEffort.has(estimatedEffortRaw)
        ? (estimatedEffortRaw as AIAdvisorActionItem['estimatedEffort'])
        : undefined;
      const steps = Array.isArray(raw.steps)
        ? raw.steps
            .filter((step): step is string => typeof step === 'string' && step.trim())
            .map((step) => step.trim())
        : undefined;

      const idCandidate =
        typeof raw.id === 'string' && raw.id.trim()
          ? raw.id.trim()
          : `${slugify(title)}-${index}`;

      return {
        id: idCandidate,
        title,
        summary,
        priority,
        urgency,
        impact,
        relatedTickers,
        dueDate,
        estimatedEffort,
        steps,
      };
    })
    .filter((item): item is AIAdvisorActionItem => item !== null);
}

function normalizeAdvisorResult(raw: any, rawText: string): AIAdvisorResult {
  const weeklySummaryCandidate = typeof raw?.weeklySummary === 'string' ? raw.weeklySummary : undefined;
  const summaryCandidate = typeof raw?.summary === 'string' ? raw.summary : undefined;

  const weeklySummary = weeklySummaryCandidate && weeklySummaryCandidate.trim()
    ? weeklySummaryCandidate
    : summaryCandidate ?? '';

  const newsHighlights = Array.isArray(raw?.newsHighlights)
    ? raw.newsHighlights
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim())
    : [];

  return {
    summary: summaryCandidate,
    weeklySummary,
    newsHighlights,
    recommendations: normalizeRecommendations(raw?.recommendations),
    signals: normalizeSignals(raw?.signals),
    actionItems: normalizeActionItems(raw?.actionItems),
    confidenceScore: typeof raw?.confidenceScore === 'number' ? raw.confidenceScore : undefined,
    riskScore: typeof raw?.riskScore === 'number' ? raw.riskScore : undefined,
    rawText,
  };
}

function generateFallbackAdvisorResult(payload: AIAdvisorPromptPayload, reason: string): AIAdvisorResult {
  const { context } = payload;
  const { summary, news } = context;
  const returnRate = summary.returnRate ?? 0;
  const sellSignal = returnRate < -5;
  const highlights = news
    .slice(0, 3)
    .map((item) => `${item.title}${item.source ? ` (${item.source})` : ''}`);

  const ticker = context.tickers?.[0] ?? 'PORTFOLIO';
  const today = new Date();
  const plusDays = (days: number) => {
    const copy = new Date(today.getTime());
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  };

  const recommendations: AIAdvisorRecommendation[] = [
    {
      ticker,
      action: sellSignal ? 'sell' : 'hold',
      reason: sellSignal
        ? '손실 구간이 길어지고 있습니다. 비중을 축소하거나 방어적 자산으로 리밸런싱을 검토하세요.'
        : '현재 수익률이 안정권에 있어 핵심 보유 종목의 비중을 유지하는 것이 권장됩니다.',
    },
    {
      ticker: 'MARKET',
      action: 'hold',
      reason: '주요 뉴스와 섹터 동향을 주기적으로 점검하고 변동성 확대 구간에 대비하세요.',
    },
    {
      ticker: 'PORTFOLIO',
      action: 'buy',
      reason: '추가 투자 시 자산 배분 비중을 재검토하여 장기 목표 비중을 맞추세요.',
    },
  ];

  const weeklySummary =
    summary.totalValue && summary.totalInvested
      ? `최근 ${context.periodDays}일 기준으로 총 투자금은 ${summary.totalInvested.toLocaleString()}원, 평가 금액은 ${summary.totalValue.toLocaleString()}원 수준입니다. 수익률은 ${formatPercent(returnRate)} 입니다.`
      : '최근 데이터를 기반으로 기본 요약을 제공합니다. 수익률 정보를 확인해주세요.';

  const actionItems: AIAdvisorActionItem[] = [
    {
      id: `rebalance-${today.getTime()}`,
      title: sellSignal ? '방어형 자산으로 리밸런싱 실행' : '핵심 종목 비중 재점검',
      summary: sellSignal
        ? '손실이 커지기 전 방어형 섹터와 현금 비중을 확대해 리스크를 줄이세요.'
        : '목표 비중과 비교하여 과도하게 커진 종목의 비중을 조정하세요.',
      priority: sellSignal ? 'high' : 'medium',
      urgency: sellSignal ? 'today' : 'this_week',
      impact: sellSignal ? 'risk' : 'diversification',
      relatedTickers: [ticker],
      dueDate: sellSignal ? plusDays(1) : plusDays(3),
      estimatedEffort: 'medium',
      steps: sellSignal
        ? [
            '리밸런싱 시뮬레이터에서 안정형 또는 방어형 프리셋을 적용합니다.',
            '손실 폭이 큰 종목부터 비중을 5% 이상 축소합니다.',
            '현금 또는 채권 ETF 비중을 최소 10% 확보합니다.',
          ]
        : [
            '섹터 분산 리포트에서 과다 비중 종목을 확인합니다.',
            '목표 비중 대비 ±5% 이상 차이 나는 종목을 표시합니다.',
            '자동투자 금액 또는 매수 계획을 조정합니다.',
          ],
    },
    {
      id: `watchlist-${today.getTime()}`,
      title: '관심 종목 및 뉴스 모니터링 강화',
      summary: '주요 뉴스와 실적 일정을 정리하고 영향도가 높은 이벤트를 준비하세요.',
      priority: 'medium',
      urgency: 'this_week',
      impact: 'risk',
      relatedTickers: context.tickers?.slice(0, 3) ?? [],
      dueDate: plusDays(7),
      estimatedEffort: 'low',
      steps: [
        '최근 7일 뉴스에서 경고성 키워드를 가진 종목을 체크합니다.',
        '실적 발표와 배당 일정이 가까운 종목을 캘린더에 기록합니다.',
        'AI 조언 히스토리에서 중요 알림을 다시 검토합니다.',
      ],
    },
    {
      id: `plan-${today.getTime()}`,
      title: '30일 투자 계획과 현금 흐름 점검',
      summary: '향후 매수/매도 계획과 자동투자 금액을 재조정하여 목표를 명확히 하세요.',
      priority: 'low',
      urgency: 'this_month',
      impact: 'return',
      relatedTickers: [],
      dueDate: plusDays(30),
      estimatedEffort: 'low',
      steps: [
        '향후 한 달간 필요한 현금 지출과 투자 여력을 계산합니다.',
        '자동투자 스케줄 및 금액이 목표 비중과 일치하는지 확인합니다.',
        'AI 조언에서 제안된 실행 항목의 진행 상황을 업데이트합니다.',
      ],
    },
  ];

  return {
    summary: weeklySummary,
    weeklySummary,
    newsHighlights: highlights.length > 0 ? highlights : ['주요 뉴스를 수집하지 못했습니다.'],
    recommendations,
    signals: {
      sellSignal,
      reason: sellSignal
        ? '최근 수익률이 하락세이므로 방어적인 비중 조정이 필요합니다.'
        : '현재 수익률과 지표가 안정적인 범위 내에 있습니다.',
      notes: sellSignal
        ? ['현금 비중을 확대하고 리스크 요소를 점검하세요.']
        : ['시장 변동성에 대비해 손익 관리 지표를 모니터링하세요.'],
    },
    confidenceScore: 0.2,
    riskScore: Math.min(Math.max(Math.abs(returnRate) / 100, 0.1), 0.9),
    actionItems,
    rawText: `Fallback generated locally. Reason: ${reason}`,
  };
}

export async function fetchAIAdvisorContext({
  periodDays,
  tickers,
}: FetchContextOptions = {}): Promise<AIAdvisorContext> {
  const appliedPeriod = periodDays && periodDays > 0 ? periodDays : DEFAULT_PERIOD_DAYS;
  const { startDate, endDate } = buildPeriodRange(appliedPeriod);

  const [purchases, newsItems, settingsDoc, statsDoc] = await Promise.all([
    getDocumentsByDateRange<DailyPurchase>('dailyPurchases', 'date', startDate, endDate).catch(
      () => []
    ),
    getDocumentsByDateRange<NewsItem>('newsItems', 'matchDate', startDate, endDate).catch(
      () => []
    ),
    getDocumentsWithLimit<AppSettings>('appSettings', 1).catch(() => []),
    getDocumentsWithLimit<DashboardStats>('dashboardStats', 1).catch(() => []),
  ]);

  const lastPurchase = purchases.length ? purchases[purchases.length - 1] : undefined;
  const summary = {
    totalInvested: purchases.reduce((sum, item) => sum + (item.purchaseAmount ?? 0), 0),
    totalValue: lastPurchase?.totalValue ?? 0,
    averagePrice: lastPurchase?.averagePrice ?? 0,
    returnRate: lastPurchase?.returnRate ?? 0,
  };

  const normalizedNews = newsItems
    .map((item) => ({
      title: item.title,
      source: item.source,
      importance: item.importance,
      matchDate: item.matchDate,
      relevanceScore: item.relevanceScore,
      category: item.category,
      publishedAt: toISOString(item.publishedAt) ?? toISOString(item.collectedAt) ?? '',
    }))
    .slice(0, 10);

  const monitoringTickers = tickers?.length
    ? tickers
    : settingsDoc[0]?.monitoringStocks ?? ['MGK'];

  return {
    periodDays: appliedPeriod,
    startDate,
    endDate,
    tickers: monitoringTickers,
    summary,
    purchases: purchases.map((item) => ({
      date: item.date,
      price: item.price,
      purchaseAmount: item.purchaseAmount,
      shares: item.shares,
      totalValue: item.totalValue,
      returnRate: item.returnRate,
    })),
    news: normalizedNews,
    settings: settingsDoc[0] ?? null,
  };
}

function buildAdvisorPrompt({ context, latestStats }: AIAdvisorPromptPayload) {
  const contextJson = JSON.stringify(context, null, 2);
  const statsJson = latestStats ? JSON.stringify(latestStats, null, 2) : null;

  return [
    '너는 10년 경력의 주식 애널리스트이자 자산관리 전문가야.',
    '아래 JSON 데이터를 분석해서 다음 항목을 한국어로 작성해줘:',
    '- 주간 요약 (3-4문장)',
    '- 핵심 뉴스: 각 항목을 한 문장으로, 최대 3개',
    '- 위험 신호: 원인과 영향 포함',
    '- 다음 주 권장 전략: 3가지 Bullet 형태',
    '- 실행 가능한 액션 아이템 3개: 우선순위, 긴급도, 영향도, 마감일, 실행 단계 포함',
    '',
    'JSON 데이터:',
    contextJson,
    statsJson ? '\n보조 지표:' : '',
    statsJson ?? '',
    '',
    '출력은 반드시 JSON 형식으로 응답해. 형식은 다음과 같아:',
    '{',
    '  "weeklySummary": "...",',
    '  "newsHighlights": ["..."],',
    '  "signals": { "sellSignal": false, "reason": "...", "notes": ["..."] },',
    '  "recommendations": ["...", "...", "..."],',
    '  "actionItems": [',
    '    {',
    '      "id": "string-id",',
    '      "title": "...",',
    '      "summary": "...",',
    '      "priority": "high|medium|low",',
    '      "urgency": "today|this_week|this_month|long_term",',
    '      "impact": "return|risk|diversification|cost|income",',
    '      "relatedTickers": ["..."],',
    '      "dueDate": "YYYY-MM-DD",',
    '      "estimatedEffort": "low|medium|high",',
    '      "steps": ["...", "..."]',
    '    }',
    '  ]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function callAIAdvisor(
  payload: AIAdvisorPromptPayload,
  options: CallAIAdvisorOptions = {}
): Promise<AIAdvisorResult> {
  const apiKey = process.env.GPT_OSS_API_KEY;
  const model = options.model ?? DEFAULT_MODEL;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const temperature = options.temperature ?? 0.2;
  const prompt = buildAdvisorPrompt(payload);

  if (!apiKey) {
    console.warn('GPT_OSS_API_KEY 미설정: 로컬 폴백 결과를 반환합니다.');
    return generateFallbackAdvisorResult(payload, 'API key missing');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        messages: [
          {
            role: 'system',
            content: 'You are a professional Korean stock market analyst.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('AI 어드바이저 호출 실패:', response.status, errorBody);
      return generateFallbackAdvisorResult(payload, `HTTP ${response.status}`);
    }

    const resultJson = await response.json();
    const rawContent =
      resultJson?.choices?.[0]?.message?.content ?? resultJson?.data ?? JSON.stringify(resultJson);

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      console.warn('AI 응답 JSON 파싱 실패, 로컬 폴백으로 대체합니다.', error);
      return generateFallbackAdvisorResult(payload, 'invalid JSON response');
    }

    if (parsed) {
      return normalizeAdvisorResult(parsed, rawContent);
    }

    return generateFallbackAdvisorResult(payload, 'parsed JSON empty');
  } catch (error) {
    console.error('AI 어드바이저 호출 중 예외 발생:', error);
    return generateFallbackAdvisorResult(
      payload,
      error instanceof Error ? error.message : 'unexpected error'
    );
  }
}

export async function storeAIInsight(
  result: AIAdvisorResult,
  context: AIAdvisorContext,
  { model, periodLabel, sourceReportId }: StoreInsightOptions = {}
): Promise<AIInsight> {
  const period = periodLabel ?? `${context.startDate}_to_${context.endDate}`;

  const payload: Omit<AIInsight, 'id'> = {
    ...result,
    generatedAt: Timestamp.now(),
    period,
    model: model ?? DEFAULT_MODEL,
    sourceReportId,
    metadata: {
      tickers: context.tickers,
      periodDays: context.periodDays,
      summary: context.summary,
    },
  };

  try {
    const id = await addDocument<AIInsight>('aiInsights', payload as AIInsight);
    return {
      ...payload,
      id,
    };
  } catch (error) {
    console.error('AI 인사이트 저장 실패. 메모리 객체로 반환합니다.', error);
    return {
      ...payload,
    };
  }
}

export async function listRecentAIInsights(limitCount = 5) {
  return queryCollection<AIInsight>('aiInsights', [orderBy('generatedAt', 'desc'), limit(limitCount)]).catch(
    () => []
  );
}

export async function attachAIAdviceToReport(
  reportId: string,
  insightId: string
): Promise<WeeklyReportWithAI | null> {
  const report = await getDocument<WeeklyReportWithAI>('weeklyReports', reportId);
  if (!report) return null;

  const insight = await getDocument<AIInsight>('aiInsights', insightId);
  if (!insight) return report;

  const enrichedReport: WeeklyReportWithAI = {
    ...report,
    aiAdvice: {
      weeklySummary: insight.weeklySummary,
      newsHighlights: insight.newsHighlights,
      recommendations: insight.recommendations,
      signals: insight.signals,
      actionItems: insight.actionItems,
      confidenceScore: insight.confidenceScore,
      rawText: insight.rawText,
      generatedAt: insight.generatedAt,
      sourceInsightId: insight.id,
    },
  };

  await updateDocument('weeklyReports', reportId, {
    aiAdvice: {
      weeklySummary: insight.weeklySummary,
      newsHighlights: insight.newsHighlights,
      recommendations: insight.recommendations,
      signals: insight.signals,
      actionItems: insight.actionItems,
      confidenceScore: insight.confidenceScore ?? null,
      rawText: insight.rawText ?? null,
      generatedAt: insight.generatedAt,
      sourceInsightId: insight.id,
    },
  });

  return enrichedReport;
}

/**
 * 다중 종목 포트폴리오 컨텍스트 조회
 */
export async function fetchPortfolioAIContext(
  userId: string,
  portfolioId: string = 'main'
): Promise<{
  positions: Position[];
  analysis: PortfolioAnalysis;
  totalValue: number;
}> {
  const positions = await getPortfolioPositions(userId, portfolioId);
  const analysis = await analyzePortfolio(userId, portfolioId);
  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);

  return {
    positions,
    analysis,
    totalValue,
  };
}

/**
 * 포트폴리오 진단 프롬프트 생성
 */
function buildPortfolioDiagnosisPrompt(
  positions: Position[],
  analysis: PortfolioAnalysis,
  recentNews?: PersonalizedNews[]
): string {
  const portfolioData = {
    totalValue: analysis.totalValue,
    totalInvested: analysis.totalInvested,
    returnRate: analysis.overallReturnRate,
    positions: positions.map(p => ({
      symbol: p.symbol,
      shares: p.shares,
      averagePrice: p.averagePrice,
      currentPrice: p.currentPrice,
      totalValue: p.totalValue,
      returnRate: p.returnRate,
      weight: (p.totalValue / analysis.totalValue) * 100,
    })),
    sectorAllocation: analysis.sectorAllocation,
    regionAllocation: analysis.regionAllocation,
    assetAllocation: analysis.assetAllocation,
    riskMetrics: analysis.riskMetrics,
    diversificationScore: analysis.diversificationScore,
  };

  const newsContext = recentNews ? {
    recentNews: recentNews.slice(0, 5).map(n => ({
      title: n.title,
      sentiment: n.sentiment,
      affectedSymbols: n.affectedPositions.map(p => p.symbol),
      personalRelevance: n.personalRelevance,
    })),
  } : null;

  return [
    '너는 20년 경력의 포트폴리오 매니저이자 자산관리 전문가야.',
    '아래 포트폴리오 데이터를 종합적으로 분석하고 다음 항목을 한국어로 작성해줘:',
    '',
    '1. 포트폴리오 진단 (3-4문장)',
    '   - 전체적인 건강도, 수익률, 리스크 수준 평가',
    '',
    '2. 강점과 약점',
    '   - 강점: 잘하고 있는 부분 2-3가지',
    '   - 약점: 개선이 필요한 부분 2-3가지',
    '',
    '3. 종목별 평가 (상위 5개 종목)',
    '   - 각 종목의 현재 상태와 향후 전망',
    '   - 매수/매도/유지 의견',
    '',
    '4. 리밸런싱 제안',
    '   - 구체적인 조정 방향',
    '   - 추천 비중',
    '',
    '5. 향후 전략 (3가지)',
    '   - 실행 가능한 구체적 액션',
    '',
    '포트폴리오 데이터:',
    JSON.stringify(portfolioData, null, 2),
    '',
    newsContext ? '최근 뉴스:' : '',
    newsContext ? JSON.stringify(newsContext, null, 2) : '',
    '',
    '출력은 반드시 JSON 형식으로 응답해. 형식은 다음과 같아:',
    '{',
    '  "diagnosis": "...",',
    '  "strengths": ["...", "..."],',
    '  "weaknesses": ["...", "..."],',
    '  "stockEvaluations": [',
    '    {',
    '      "symbol": "...",',
    '      "evaluation": "...",',
    '      "recommendation": "buy|sell|hold",',
    '      "reason": "..."',
    '    }',
    '  ],',
    '  "rebalancingSuggestion": "...",',
    '  "strategies": ["...", "...", "..."],',
    '  "overallScore": 85',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 포트폴리오 AI 진단
 */
export interface PortfolioDiagnosisResult {
  diagnosis: string;
  strengths: string[];
  weaknesses: string[];
  stockEvaluations: {
    symbol: string;
    evaluation: string;
    recommendation: 'buy' | 'sell' | 'hold';
    reason: string;
  }[];
  rebalancingSuggestion: string;
  strategies: string[];
  overallScore?: number;
  rawText?: string;
}

export async function diagnosePortfolio(
  userId: string,
  portfolioId: string = 'main',
  recentNews?: PersonalizedNews[]
): Promise<PortfolioDiagnosisResult> {
  const apiKey = process.env.GPT_OSS_API_KEY;
  if (!apiKey) {
    throw new Error('GPT_OSS_API_KEY가 설정되지 않았습니다.');
  }

  const { positions, analysis } = await fetchPortfolioAIContext(userId, portfolioId);

  if (positions.length === 0) {
    throw new Error('포트폴리오에 종목이 없습니다.');
  }

  const prompt = buildPortfolioDiagnosisPrompt(positions, analysis, recentNews);

  const response = await fetch(DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a professional portfolio manager and financial advisor.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI 진단 호출 실패 (${response.status}): ${errorBody}`);
  }

  const resultJson = await response.json();
  const rawContent =
    resultJson?.choices?.[0]?.message?.content ?? resultJson?.data ?? JSON.stringify(resultJson);

  let parsed: PortfolioDiagnosisResult | null = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.warn('AI 응답 JSON 파싱 실패', error);
    throw new Error('AI 응답에서 유효한 JSON을 찾을 수 없습니다.');
  }

  if (!parsed) {
    throw new Error('AI 응답 파싱 결과가 null입니다.');
  }

  return {
    diagnosis: parsed.diagnosis || '',
    strengths: parsed.strengths || [],
    weaknesses: parsed.weaknesses || [],
    stockEvaluations: parsed.stockEvaluations || [],
    rebalancingSuggestion: parsed.rebalancingSuggestion || '',
    strategies: parsed.strategies || [],
    overallScore: parsed.overallScore,
    rawText: rawContent,
  };
}

/**
 * 개별 종목 분석 프롬프트
 */
function buildStockAnalysisPrompt(
  position: Position,
  recentNews?: PersonalizedNews[]
): string {
  const stockData = {
    symbol: position.symbol,
    shares: position.shares,
    averagePrice: position.averagePrice,
    currentPrice: position.currentPrice,
    totalInvested: position.totalInvested,
    totalValue: position.totalValue,
    returnRate: position.returnRate,
    profitLoss: position.profitLoss,
    firstPurchaseDate: position.firstPurchaseDate,
    transactionCount: position.transactionCount,
  };

  const relatedNews = recentNews?.filter(
    n => n.affectedPositions.some(p => p.symbol === position.symbol)
  ).slice(0, 3);

  return [
    `너는 ${position.symbol} 종목 전문 애널리스트야.`,
    '아래 데이터를 분석하고 다음 항목을 한국어로 작성해줘:',
    '',
    '1. 종목 평가 (2-3문장)',
    '   - 현재 투자 상태 및 성과 평가',
    '',
    '2. 매수/매도/유지 의견',
    '   - 명확한 추천과 이유',
    '',
    '3. 가격 목표',
    '   - 단기(1개월), 중기(3개월) 목표가',
    '',
    '4. 리스크 요인',
    '   - 주의해야 할 리스크 2-3가지',
    '',
    '5. 액션 아이템',
    '   - 구체적인 실행 항목',
    '',
    '종목 데이터:',
    JSON.stringify(stockData, null, 2),
    '',
    relatedNews && relatedNews.length > 0 ? '관련 뉴스:' : '',
    relatedNews && relatedNews.length > 0
      ? JSON.stringify(
          relatedNews.map(n => ({
            title: n.title,
            sentiment: n.sentiment,
            personalRelevance: n.personalRelevance,
          })),
          null,
          2
        )
      : '',
    '',
    '출력은 반드시 JSON 형식으로 응답해:',
    '{',
    '  "evaluation": "...",',
    '  "recommendation": "buy|sell|hold",',
    '  "reason": "...",',
    '  "priceTargets": {',
    '    "shortTerm": 150.5,',
    '    "mediumTerm": 165.0',
    '  },',
    '  "risks": ["...", "..."],',
    '  "actionItems": ["...", "..."]',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 개별 종목 AI 분석
 */
export interface StockAnalysisResult {
  symbol: string;
  evaluation: string;
  recommendation: 'buy' | 'sell' | 'hold';
  reason: string;
  priceTargets?: {
    shortTerm: number;
    mediumTerm: number;
  };
  risks: string[];
  actionItems: string[];
  rawText?: string;
}

export async function analyzeStock(
  position: Position,
  recentNews?: PersonalizedNews[]
): Promise<StockAnalysisResult> {
  const apiKey = process.env.GPT_OSS_API_KEY;
  if (!apiKey) {
    throw new Error('GPT_OSS_API_KEY가 설정되지 않았습니다.');
  }

  const prompt = buildStockAnalysisPrompt(position, recentNews);

  const response = await fetch(DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are a ${position.symbol} stock specialist and analyst.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`AI 종목 분석 호출 실패 (${response.status}): ${errorBody}`);
  }

  const resultJson = await response.json();
  const rawContent =
    resultJson?.choices?.[0]?.message?.content ?? resultJson?.data ?? JSON.stringify(resultJson);

  let parsed: Omit<StockAnalysisResult, 'symbol'> | null = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.warn('AI 응답 JSON 파싱 실패', error);
    throw new Error('AI 응답에서 유효한 JSON을 찾을 수 없습니다.');
  }

  if (!parsed) {
    throw new Error('AI 응답 파싱 결과가 null입니다.');
  }

  return {
    symbol: position.symbol,
    evaluation: parsed.evaluation || '',
    recommendation: parsed.recommendation || 'hold',
    reason: parsed.reason || '',
    priceTargets: parsed.priceTargets,
    risks: parsed.risks || [],
    actionItems: parsed.actionItems || [],
    rawText: rawContent,
  };
}

