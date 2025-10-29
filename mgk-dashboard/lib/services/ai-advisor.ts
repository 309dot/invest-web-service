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
  AIAdvisorResult,
  AIInsight,
  AppSettings,
  DailyPurchase,
  DashboardStats,
  NewsItem,
  WeeklyReportWithAI,
  Position,
} from '@/types';
import type { PortfolioAnalysis } from './portfolio-analysis';
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
    '  "signals": { "sellSignal": false, "reason": "..." },',
    '  "recommendations": ["...", "...", "..."]',
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
  if (!apiKey) {
    throw new Error('GPT_OSS_API_KEY가 설정되지 않았습니다. 환경 변수를 확인하세요.');
  }

  const model = options.model ?? DEFAULT_MODEL;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const temperature = options.temperature ?? 0.2;

  const prompt = buildAdvisorPrompt(payload);

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
    throw new Error(`AI 어드바이저 호출 실패 (${response.status}): ${errorBody}`);
  }

  const resultJson = await response.json();
  const rawContent =
    resultJson?.choices?.[0]?.message?.content ?? resultJson?.data ?? JSON.stringify(resultJson);

  let parsed: AIAdvisorResult | null = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    console.warn('AI 응답 JSON 파싱 실패, 수동 파싱을 시도합니다.', error);
  }

  if (!parsed) {
    throw new Error('AI 응답에서 유효한 JSON을 찾을 수 없습니다.');
  }

  return {
    weeklySummary: parsed.weeklySummary ?? '',
    newsHighlights: parsed.newsHighlights ?? [],
    signals: parsed.signals ?? { sellSignal: false, reason: '' },
    recommendations: parsed.recommendations ?? [],
    confidenceScore: parsed.confidenceScore,
    rawText: rawContent,
  };
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

  return {
    ...parsed,
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
    profitLoss: position.unrealizedProfitLoss,
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

  return {
    symbol: position.symbol,
    ...parsed,
    rawText: rawContent,
  };
}

