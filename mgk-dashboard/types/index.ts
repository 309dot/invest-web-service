import { Timestamp } from 'firebase/firestore';

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
}
