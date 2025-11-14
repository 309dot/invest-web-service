import { Timestamp } from 'firebase/firestore';
import type { SupportedCurrency } from '@/lib/currency';

// ============================================
// 다중 종목 포트폴리오 시스템 타입
// ============================================

// 구매 방식 (자동투자 vs 일괄투자)
export type PurchaseMethod = 'auto' | 'manual';

// 구매 단위 (주 단위 vs 금액 단위)
export type PurchaseUnit = 'shares' | 'amount';

// 자동투자 주기
export type AutoInvestFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

// 거래 유형
export type TransactionType = 'buy' | 'sell' | 'dividend';

// 시장 구분
export type Market = 'US' | 'KR' | 'GLOBAL';

// 자산 유형
export type AssetType = 'stock' | 'etf' | 'reit' | 'fund';

// 섹터 (GICS 11개 섹터)
export type Sector =
  | 'communication-services'
  | 'consumer-discretionary'
  | 'consumer-staples'
  | 'energy'
  | 'financials'
  | 'health-care'
  | 'industrials'
  | 'information-technology'
  | 'materials'
  | 'real-estate'
  | 'utilities'
  | 'other';

// 종목 마스터 데이터
export interface Stock {
  id?: string;
  symbol: string; // 티커 심볼 (예: AAPL, 005930)
  name: string; // 종목명
  market: Market; // 시장
  assetType: AssetType; // 자산 유형
  sector?: Sector; // 섹터 (GICS)
  sectorBreakdown?: Record<Sector, number>; // ETF 등 섹터 비중 (0-1 사이)
  currency: 'USD' | 'KRW'; // 거래 통화
  exchange?: string; // 거래소 (예: NASDAQ, KOSPI)
  description?: string; // 종목 설명
  logoUrl?: string; // 로고 이미지 URL
  website?: string; // 기업 웹사이트
  // 메타데이터
  lastUpdated?: Timestamp;
  searchCount?: number; // 검색 횟수 (인기도)
  createdAt: Timestamp;
}

// 포트폴리오 (사용자별 포트폴리오 컨테이너)
export interface Portfolio {
  id?: string;
  userId: string; // 사용자 ID
  name: string; // 포트폴리오 이름 (예: "메인 포트폴리오", "은퇴 자금")
  description?: string;
  isDefault: boolean; // 기본 포트폴리오 여부
  totalInvested: number; // 총 투자 금액 (USD)
  totalValue: number; // 총 평가액 (USD)
  returnRate: number; // 수익률 (%)
  cashBalance: number; // 현금 잔액 (USD)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 포지션 (포트폴리오 내 종목별 보유 현황)
export interface Position {
  id?: string;
  portfolioId: string; // 포트폴리오 ID
  stockId: string; // 종목 ID
  symbol: string; // 티커 심볼 (빠른 조회용)
  name: string; // 종목명
  market: 'US' | 'KR' | 'GLOBAL'; // 시장
  exchange: string; // 거래소
  assetType: 'stock' | 'etf' | 'reit' | 'fund'; // 자산 유형
  sector?: string; // 섹터
  currency: 'USD' | 'KRW'; // 통화
  // 보유 정보
  shares: number; // 보유 주식 수
  averagePrice: number; // 평균 매수가
  totalInvested: number; // 총 투자 금액
  currentPrice: number; // 현재 주가
  totalValue: number; // 총 평가액
  returnRate: number; // 수익률 (%)
  profitLoss: number; // 손익
  priceSource?: 'realtime' | 'historical' | 'fallback' | 'cached';
  priceTimestamp?: string;
  // 구매 방식 정보
  purchaseMethod: PurchaseMethod; // 자동/수동
  autoInvestConfig?: {
    frequency: AutoInvestFrequency; // 주기
    amount: number; // 투자 금액
    startDate: string; // 시작일 (YYYY-MM-DD)
    isActive: boolean; // 활성화 여부
    lastExecuted?: string; // 마지막 실행일
    currentScheduleId?: string; // 활성 스케줄 ID
    lastUpdated?: string; // 마지막 수정일 (YYYY-MM-DD)
  };
  sellAlert?: SellAlertConfig;
  // 메타데이터
  firstPurchaseDate: string; // 최초 매수일 (YYYY-MM-DD)
  lastTransactionDate: string; // 마지막 거래일
  transactionCount: number; // 거래 횟수
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SellAlertConfig {
  enabled: boolean;
  targetReturnRate: number;
  sellRatio: number;
  notifyEmail?: string | null;
  triggerOnce?: boolean;
  lastTriggeredAt?: string | null;
}

// 거래 이력 (매수/매도 기록)
export interface Transaction {
  id?: string;
  portfolioId: string; // 포트폴리오 ID
  positionId: string; // 포지션 ID
  stockId: string; // 종목 ID
  symbol: string; // 티커 심볼
  // 거래 정보
  type: TransactionType; // 거래 유형
  date: string; // 거래일 (YYYY-MM-DD)
  price: number; // 거래 가격 (현지 통화)
  shares: number; // 거래 주식 수
  amount: number; // 거래 금액 (현지 통화)
  fee: number; // 수수료 (현지 통화)
  tax?: number; // 세금 (현지 통화)
  totalAmount: number; // 총 금액 (수수료 포함)
  currency?: 'USD' | 'KRW';
  displayDate?: string; // 사용자 표시용 일자 (KST 기준)
  executedAt?: string; // 거래 실행 시간 (ISO)
  // 환율 정보 (한국 주식의 경우)
  exchangeRate?: number; // USD/KRW 환율
  krwAmount?: number; // 원화 환산 금액
  // 구매 방식
  purchaseMethod: PurchaseMethod; // 자동/수동
  purchaseUnit: PurchaseUnit; // 주/금액 단위
  // 메모
  memo?: string;
  // 메타데이터
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  status?: 'pending' | 'completed' | 'failed';
  scheduledDate?: string;
  failureReason?: string;
}

export interface TransactionCurrencyStats {
  totalBuys: number;
  totalSells: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  averageBuyPrice: number;
  averageSellPrice: number;
}

export interface TransactionCombinedStats {
  totalBuyAmount: number;
  totalSellAmount: number;
  netAmount: number;
}

export interface TransactionStats {
  transactionCount: number;
  byCurrency: Record<'USD' | 'KRW', TransactionCurrencyStats>;
  combined: {
    baseCurrency: SupportedCurrency;
    totalBuyAmount: number;
    totalSellAmount: number;
    netAmount: number;
  };
  converted: Record<'USD' | 'KRW', TransactionCombinedStats>;
  exchangeRate?: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'cache' | 'live' | 'fallback';
  };
}

export type TransactionTimelineGranularity = 'week' | 'month';

export interface TransactionTimelineSymbolSummary {
  symbol: string;
  count: number;
  buyAmountBase: number;
  sellAmountBase: number;
}

export interface TransactionTimelineEntry {
  id: string;
  label: string;
  granularity: TransactionTimelineGranularity;
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  buyCount: number;
  sellCount: number;
  autoCount: number;
  manualCount: number;
  totalsByCurrency: Record<
    'USD' | 'KRW',
    {
      buyAmount: number;
      sellAmount: number;
      netAmount: number;
    }
  >;
  netAmountBase: number;
  topSymbols: TransactionTimelineSymbolSummary[];
}

export interface TransactionTimelineResponse {
  entries: TransactionTimelineEntry[];
  granularity: TransactionTimelineGranularity;
  baseCurrency: 'USD';
  generatedAt: string;
  exchangeRate: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'cache' | 'live' | 'fallback';
  };
}

export interface AutoInvestSchedule {
  id?: string;
  userId: string;
  portfolioId: string;
  positionId: string;
  frequency: AutoInvestFrequency;
  amount: number;
  currency: 'USD' | 'KRW';
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null; // YYYY-MM-DD
  note?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// 포트폴리오 분석 결과
export interface PortfolioAnalysis {
  portfolioId: string;
  // 포트폴리오 총괄
  totalValue: number; // 총 평가액
  totalInvested: number; // 총 투자금
  overallReturnRate: number; // 전체 수익률 (%)
  baseCurrency: 'USD' | 'KRW';
  exchangeRate: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'cache' | 'live' | 'fallback';
  };
  currencyTotals: Record<'USD' | 'KRW', {
    originalValue: number;
    originalInvested: number;
    convertedValue: number;
    convertedInvested: number;
    count: number;
  }>;
  // 섹터별 분산
  sectorAllocation: {
    sector: Sector;
    value: number; // 평가액
    percentage: number; // 비중 (%)
    returnRate: number; // 수익률
    count: number;
  }[];
  // 지역별 분산
  regionAllocation: {
    region: Market;
    value: number;
    percentage: number;
    returnRate: number;
    count: number;
  }[];
  // 자산 유형별 분산
  assetAllocation: {
    assetType: AssetType;
    value: number;
    percentage: number;
    returnRate: number;
    count: number;
  }[];
  // 리스크 분석
  riskMetrics: {
    volatility: number; // 변동성
    sharpeRatio: number; // 샤프 비율
    maxDrawdown: number; // 최대 낙폭
    concentration: number;
  };
  // 수익률 기여도 (상위 5개)
  topContributors: {
    symbol: string;
    contribution: number; // 기여도
    weight: number; // 포트폴리오 내 비중
    returnRate: number;
  }[];
  // 리밸런싱 제안
  rebalancingSuggestions: {
    symbol: string;
    currency: 'USD' | 'KRW';
    currentWeight: number;
    targetWeight: number;
    action: 'buy' | 'sell' | 'hold';
    amount: number;
    baseAmount: number;
    reason: string;
  }[];
  benchmarkComparison: Array<{
    id: 'KOSPI' | 'SNP_500' | 'GLOBAL_60_40';
    name: string;
    symbol: string;
    returnRate: number | null;
    since: string;
    currency: 'USD' | 'KRW';
    source: 'yahoo' | 'cache' | 'fallback';
    lastPrice: number | null;
    note?: string;
  }>;
  diversificationScore: number;
  timestamp: string;
}

export type PortfolioPerformancePeriodId =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | 'YTD'
  | '1Y'
  | 'ALL';

export interface PortfolioPerformancePeriod {
  id: PortfolioPerformancePeriodId;
  label: string;
  startDate: string;
  endDate: string;
  periodDays: number;
  sampleCount: number;
  startValue: number | null;
  endValue: number | null;
  absoluteReturn: number | null;
  totalReturn: number | null;
  annualizedReturn: number | null;
  startInvested: number | null;
  endInvested: number | null;
  investedChange: number | null;
  source: 'dailyPurchases' | 'calculated' | 'insufficient-data';
  note?: string;
}

export interface RebalancingPreset {
  id: string;
  name: string;
  description: string;
  weights: Record<string, number>;
  meta?: {
    category?: 'balanced' | 'defensive' | 'aggressive' | 'ai' | 'custom';
    riskLevel?: 'low' | 'medium' | 'high';
    focus?: string;
  };
}

export type StockComparisonPeriod = '1m' | '3m' | '6m' | '1y';

export interface StockComparisonPoint {
  date: string;
  price: number | null;
  returnPct: number | null;
}

export interface StockComparisonMetrics {
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  volatilityPct: number | null;
  sharpe: number | null;
  maxDrawdownPct: number | null;
  bestDayPct: number | null;
  worstDayPct: number | null;
  tradingDays: number;
  startPrice: number | null;
  endPrice: number | null;
}

export interface StockComparisonSeries {
  symbol: string;
  name: string;
  currency: SupportedCurrency;
  market: Position['market'] | 'BENCHMARK';
  isBenchmark: boolean;
  logoUrl?: string | null;
  basePrice: number | null;
  latestPrice: number | null;
  latestReturnPct: number | null;
  data: StockComparisonPoint[];
  metrics: StockComparisonMetrics;
}

export interface StockComparisonResponse {
  success: boolean;
  period: StockComparisonPeriod;
  baseCurrency: SupportedCurrency;
  includeBenchmarks: boolean;
  series: StockComparisonSeries[];
  generatedAt: string;
  meta?: Record<string, unknown>;
}

export interface ContributionBreakdownEntry {
  symbol: string;
  name: string;
  market: Position['market'];
  currency: SupportedCurrency;
  weightPct: number;
  returnPct: number;
  contributionPct: number;
  contributionValue: number;
  investmentValue: number;
  currentValue: number;
  averagePrice: number;
  currentPrice: number;
  transactions: number;
  isTopContributor: boolean;
  isLagging: boolean;
  tag?: 'core' | 'supporting' | 'reducing' | 'watch';
}

export interface ContributionBreakdownResponse {
  success: boolean;
  period: StockComparisonPeriod;
  baseCurrency: SupportedCurrency;
  entries: ContributionBreakdownEntry[];
  totals: {
    totalContributionValue: number;
    totalContributionPct: number;
    totalInvested: number;
    totalValue: number;
  };
  generatedAt: string;
  meta?: Record<string, unknown>;
}

export interface CorrelationSymbol {
  symbol: string;
  name: string;
  currency: SupportedCurrency;
  isBenchmark: boolean;
}

export interface CorrelationMatrixResponse {
  success: boolean;
  period: StockComparisonPeriod;
  baseCurrency: SupportedCurrency;
  symbols: CorrelationSymbol[];
  matrix: (number | null)[][];
  generatedAt: string;
  meta?: Record<string, unknown>;
}

export type SmartAlertSeverity = 'emergency' | 'important' | 'info';

export interface SmartAlert {
  id: string;
  severity: SmartAlertSeverity;
  title: string;
  description: string;
  createdAt: string;
  symbol?: string;
  tags?: string[];
  recommendedAction?: string;
  data?: Record<string, unknown>;
}

export interface SmartAlertResponse {
  success: boolean;
  baseCurrency: SupportedCurrency;
  alerts: SmartAlert[];
  generatedAt: string;
  meta?: {
    counts: Record<SmartAlertSeverity, number>;
  };
}

export type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

export type InvestmentGoal = 'growth' | 'income' | 'balanced' | 'capital-preservation';

export interface PersonalizationSettings {
  riskProfile: RiskProfile;
  investmentGoal: InvestmentGoal;
  focusAreas: string[];
  lastUpdated: string;
}

export type MarketMode = 'bullish' | 'bearish' | 'neutral';

export interface PersonalizedHeroMetric {
  id: string;
  label: string;
  value: number;
  type: 'currency' | 'percent' | 'score';
  change?: number | null;
  currency?: SupportedCurrency;
}

export interface PersonalizedHero {
  headline: string;
  subheading: string;
  mood: 'positive' | 'negative' | 'neutral';
  metrics: PersonalizedHeroMetric[];
}

export interface PersonalizedMetric {
  id: string;
  label: string;
  value: number;
  type: 'currency' | 'percent' | 'score';
  currency?: SupportedCurrency;
  description?: string;
  change?: number | null;
  emphasis?: 'positive' | 'negative' | 'neutral';
}

export interface PersonalizedAction {
  id: string;
  title: string;
  summary: string;
  severity: SmartAlertSeverity;
  source: 'alert' | 'ai' | 'system';
  createdAt: string;
  relatedSymbol?: string;
}

export interface PersonalizedDashboardResponse {
  success: boolean;
  settings: PersonalizationSettings;
  marketMode: MarketMode;
  baseCurrency: SupportedCurrency;
  hero: PersonalizedHero;
  metrics: PersonalizedMetric[];
  actions: PersonalizedAction[];
  recommendedWidgets: string[];
  updatedAt: string;
}

export type ScenarioPreset = 'bullish' | 'bearish' | 'volatile' | 'custom';

export interface ScenarioConfig {
  preset: ScenarioPreset;
  marketShiftPct: number;
  usdShiftPct: number;
  additionalContribution: number;
  notes?: string;
}

export interface ScenarioPositionProjection {
  symbol: string;
  name?: string;
  currency: SupportedCurrency;
  shares: number;
  currentPrice: number;
  projectedPrice: number;
  currentValue: number;
  projectedValue: number;
  projectedProfitLoss: number;
  projectedReturnRate: number;
}

export interface ScenarioAnalysisResult {
  currentTotalValue: number;
  projectedTotalValue: number;
  projectedReturnRate: number;
  projectedProfitLoss: number;
  additionalContribution: number;
  marketShiftPct: number;
  usdShiftPct: number;
  positions: ScenarioPositionProjection[];
}

export interface ScenarioAnalysisResponse {
  success: boolean;
  config: ScenarioConfig;
  result: ScenarioAnalysisResult;
  generatedAt: string;
}

export interface TaxOptimizationConfig {
  targetHarvestAmount: number;
  estimatedTaxRate: number;
}

export interface TaxOptimizationPosition {
  symbol: string;
  name?: string;
  currency: SupportedCurrency;
  shares: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  returnRate: number;
  harvestAmount: number;
  action: 'harvest-loss' | 'offset-gain' | 'monitor';
}

export interface TaxOptimizationSummary {
  totalUnrealizedGain: number;
  totalUnrealizedLoss: number;
  netUnrealized: number;
  harvestTarget: number;
  harvestAchieved: number;
  estimatedTaxSavings: number;
}

export interface TaxOptimizationResponse {
  success: boolean;
  config: TaxOptimizationConfig;
  summary: TaxOptimizationSummary;
  candidates: TaxOptimizationPosition[];
  generatedAt: string;
}

export interface OptimizerAction {
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  weightDelta: number;
  amountBase: number;
  rationale: string;
}

export interface OptimizerRecommendation {
  id: string;
  name: string;
  summary: string;
  rationale: string[];
  targetWeights: Record<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  rebalancing: OptimizerAction[];
}

export interface PortfolioOptimizerResponse {
  success: boolean;
  baseCurrency: SupportedCurrency;
  currentWeights: Record<string, number>;
  recommendations: OptimizerRecommendation[];
  generatedAt: string;
}

export type BacktestStrategy = 'baseline' | 'equal' | 'growth' | 'defensive' | 'diversified';

export interface BacktestRequest {
  periodDays?: number;
  strategy?: BacktestStrategy;
}

export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  maxDrawdown: number;
}

export interface BacktestSeriesPoint {
  date: string;
  baseline: number;
  scenario: number;
}

export interface BacktestResponse {
  success: boolean;
  strategy: BacktestStrategy;
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  baseline: BacktestMetrics;
  scenario: BacktestMetrics;
  series: BacktestSeriesPoint[];
  generatedAt: string;
}

// ============================================
// 기존 타입 (하위 호환성 유지)
// ============================================

// Daily Purchase Record
export interface DailyPurchase {
  id?: string;
  date: string; // YYYY-MM-DD
  price: number; // MGK stock price
  exchangeRate: number; // USD/KRW
  purchaseAmount: number; // Purchase amount in USD
  shares: number; // Number of shares purchased
  totalShares: number; // Cumulative shares
  averagePrice: number; // Average purchase price
  totalValue: number; // Total portfolio value
  returnRate: number; // Return rate (%)
  sellSignal: boolean; // Sell signal flag
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Dollar Charge Record
export interface DollarCharge {
  id?: string;
  chargeDate: string; // YYYY-MM-DD
  amount: number; // Charge amount in USD
  exchangeRate: number; // Exchange rate at charge
  krwAmount: number; // Amount in KRW
  fee: number; // Transaction fee
  totalBalance: number; // Cumulative balance
  memo?: string; // Optional memo
  createdAt: Timestamp;
}

// News Item
export interface NewsItem {
  id?: string;
  collectedAt: Timestamp;
  title: string;
  source: string;
  link: string;
  publishedAt: Timestamp;
  importance: 'High' | 'Medium' | 'Low';
  relatedStock?: string;
  matchDate?: string; // YYYY-MM-DD
  relevanceScore: number; // 0-100
  category: 'tech' | 'economy' | 'market';
}

// Weekly Report
export interface WeeklyReport {
  id?: string;
  week: string; // YYYY-WW (e.g., 2024-W42)
  period: string; // "2024-10-14 to 2024-10-20"
  weeklyReturn: number; // Weekly return rate (%)
  highPrice: number;
  lowPrice: number;
  volatility: number;
  topNews: {
    title: string;
    link: string;
    importance: 'High' | 'Medium' | 'Low';
  }[];
  learningPoints: string[];
  generatedAt: Timestamp;
}

export interface WeeklyReportWithAI extends WeeklyReport {
  aiAdvice?: AIAdvisorResult & {
    generatedAt?: Timestamp;
    sourceInsightId?: string;
  };
}

// App Settings
export interface AppSettings {
  id?: string;
  sellSignalThreshold: number; // Sell signal threshold (%)
  sellRatio: number; // Sell ratio (%)
  minDollarBalance: number; // Minimum dollar balance
  goodExchangeRate: number; // Good exchange rate threshold
  notificationEmail: string;
  dailyPurchaseAmount: number; // Daily purchase amount
  autoCollectNews: boolean;
  newsImportanceThreshold: number; // News collection volatility threshold
  monitoringStocks: string[]; // Stock ticker symbols
  watchlist?: WatchlistItem[]; // Detailed watchlist entries
}

// Automation Log
export interface AutomationLog {
  id?: string;
  type: 'daily-update' | 'news-collection' | 'weekly-report';
  status: 'success' | 'failed';
  timestamp: Timestamp;
  data?: {
    priceCollected?: number;
    newsCount?: number;
    [key: string]: any;
  };
  error?: string | null;
}

// Dashboard Statistics (computed)
export interface DashboardStats {
  currentPrice: number;
  totalShares: number;
  totalValue: number;
  totalInvested: number;
  returnRate: number;
  averagePrice: number;
  todayChange: number;
  todayChangePercent: number;
  dollarBalance: number;
}

// Price Data from API
export interface PriceData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

// Exchange Rate Data from API
export interface ExchangeRateData {
  base: string;
  target: string;
  rate: number;
  timestamp: Date;
}

// Chart Data Point
export interface ChartDataPoint {
  date: string;
  price: number;
  returnRate: number;
  totalValue: number;
}

// Form Data Types
export interface ManualPurchaseForm {
  date: string;
  price: number;
  purchaseAmount: number;
}

export interface DollarChargeForm {
  chargeDate: string;
  amount: number;
  exchangeRate: number;
  fee: number;
  memo?: string;
}

export interface SettingsForm {
  sellSignalThreshold: number;
  sellRatio: number;
  minDollarBalance: number;
  goodExchangeRate: number;
  notificationEmail: string;
  dailyPurchaseAmount: number;
  autoCollectNews: boolean;
  newsImportanceThreshold: number;
  monitoringStocks: string[];
  watchlist: WatchlistItem[];
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  targetPrice?: number;
  memo?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// AI Advisor Context
export interface AIAdvisorContext {
  periodDays: number;
  startDate: string;
  endDate: string;
  tickers: string[];
  summary: {
    totalInvested: number;
    totalValue: number;
    averagePrice: number;
    returnRate: number;
  };
  purchases: Array<
    Pick<
      DailyPurchase,
      'date' | 'price' | 'purchaseAmount' | 'shares' | 'totalValue' | 'returnRate'
    >
  >;
  news: Array<
    Pick<
      NewsItem,
      'title' | 'source' | 'importance' | 'matchDate' | 'relevanceScore' | 'category'
    > & { publishedAt: string }
  >;
  settings: Partial<AppSettings> | null;
}

export interface AIAdvisorPromptPayload {
  context: AIAdvisorContext;
  latestStats?: Partial<DashboardStats>;
}

export interface AIAdvisorRecommendation {
  ticker: string;
  action: 'buy' | 'sell' | 'hold';
  reason: string;
  confidence?: number;
}

export interface AIAdvisorSignal {
  sellSignal: boolean;
  reason: string;
  notes?: string[];
}

export interface AIAdvisorActionItem {
  id: string;
  title: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  urgency: 'today' | 'this_week' | 'this_month' | 'long_term';
  impact: 'return' | 'risk' | 'diversification' | 'cost' | 'income' | string;
  relatedTickers?: string[];
  dueDate?: string;
  estimatedEffort?: 'low' | 'medium' | 'high';
  steps?: string[];
}

export interface AIAdvisorResult {
  summary?: string;
  weeklySummary: string;
  newsHighlights: string[];
  recommendations: AIAdvisorRecommendation[];
  signals: AIAdvisorSignal;
  actionItems: AIAdvisorActionItem[];
  confidenceScore?: number;
  riskScore?: number;
  rawText?: string;
}

export interface AIInsight extends AIAdvisorResult {
  id?: string;
  generatedAt: Timestamp;
  period: string;
  model: string;
  sourceReportId?: string;
  metadata?: Record<string, any>;
}

export interface WeeklySummary {
  week: string;
  period: string;
  totalInvested: number;
  totalValue: number;
  averagePrice: number;
  returnRate: number;
  volatility: number;
  highestPrice: number;
  lowestPrice: number;
}

// 스케줄 업데이트 요청
export interface UpdateAutoInvestScheduleRequest {
  scheduleId: string;
  frequency?: AutoInvestFrequency;
  amount?: number;
  effectiveFrom?: string;
  note?: string;
  regenerateTransactions?: boolean;
}

// 스케줄 재적용 요청
export interface ReapplyScheduleRequest {
  scheduleId: string;
  effectiveFrom: string;
  pricePerShare?: number;
}

// 거래 재생성 미리보기
export interface TransactionRewritePreview {
  toDelete: number;
  toCreate: number;
  dateRange: { from: string; to: string };
}
