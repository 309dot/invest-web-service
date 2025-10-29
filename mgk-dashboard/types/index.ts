import { Timestamp } from 'firebase/firestore';

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

// 섹터
export type Sector = 
  | 'technology'
  | 'healthcare'
  | 'financial'
  | 'consumer'
  | 'industrial'
  | 'energy'
  | 'materials'
  | 'utilities'
  | 'real-estate'
  | 'communication'
  | 'other';

// 종목 마스터 데이터
export interface Stock {
  id?: string;
  symbol: string; // 티커 심볼 (예: AAPL, 005930)
  name: string; // 종목명
  market: Market; // 시장
  assetType: AssetType; // 자산 유형
  sector?: Sector; // 섹터
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
  // 구매 방식 정보
  purchaseMethod: PurchaseMethod; // 자동/수동
  autoInvestConfig?: {
    frequency: AutoInvestFrequency; // 주기
    amount: number; // 투자 금액
    startDate: string; // 시작일 (YYYY-MM-DD)
    isActive: boolean; // 활성화 여부
    lastExecuted?: string; // 마지막 실행일
  };
  // 메타데이터
  firstPurchaseDate: string; // 최초 매수일 (YYYY-MM-DD)
  lastTransactionDate: string; // 마지막 거래일
  transactionCount: number; // 거래 횟수
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  price: number; // 거래 가격 (USD)
  shares: number; // 거래 주식 수
  amount: number; // 거래 금액 (USD)
  fee: number; // 수수료 (USD)
  totalAmount: number; // 총 금액 (수수료 포함)
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
}

// 포트폴리오 분석 결과
export interface PortfolioAnalysis {
  portfolioId: string;
  // 포트폴리오 총괄
  totalValue: number; // 총 평가액
  totalInvested: number; // 총 투자금
  overallReturnRate: number; // 전체 수익률 (%)
  // 섹터별 분산
  sectorAllocation: {
    sector: Sector;
    value: number; // 평가액
    percentage: number; // 비중 (%)
    returnRate: number; // 수익률
  }[];
  // 지역별 분산
  regionAllocation: {
    market: Market;
    value: number;
    percentage: number;
    returnRate: number;
  }[];
  // 자산 유형별 분산
  assetAllocation: {
    assetType: AssetType;
    value: number;
    percentage: number;
    returnRate: number;
  }[];
  // 리스크 분석
  riskMetrics: {
    volatility: number; // 변동성
    sharpeRatio: number; // 샤프 비율
    maxDrawdown: number; // 최대 낙폭
    beta?: number; // 베타 (시장 대비)
  };
  // 수익률 기여도 (상위 5개)
  topContributors: {
    symbol: string;
    contribution: number; // 기여도 (%)
    returnRate: number;
  }[];
  // 리밸런싱 제안
  rebalancingSuggestions?: {
    symbol: string;
    currentPercentage: number;
    targetPercentage: number;
    action: 'buy' | 'sell' | 'hold';
    amount?: number;
  }[];
  generatedAt: Timestamp;
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

export interface AIAdvisorResult {
  weeklySummary: string;
  newsHighlights: string[];
  signals: {
    sellSignal: boolean;
    reason: string;
    [key: string]: any;
  };
  recommendations: string[];
  confidenceScore?: number;
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
