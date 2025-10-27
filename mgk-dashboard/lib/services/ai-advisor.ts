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
} from '@/types';

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

