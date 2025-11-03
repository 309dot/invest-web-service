import { DailyPurchase } from '@/types';

/**
 * Calculate return rate percentage
 */
export function calculateReturnRate(currentValue: number, investedAmount: number): number {
  if (!Number.isFinite(currentValue) || !Number.isFinite(investedAmount) || investedAmount <= 0) {
    return 0;
  }
  return ((currentValue - investedAmount) / investedAmount) * 100;
}

/**
 * Calculate average purchase price
 */
export function calculateAveragePrice(purchases: DailyPurchase[]): number {
  if (purchases.length === 0) return 0;

  let totalCost = 0;
  let totalShares = 0;

  purchases.forEach(purchase => {
    totalCost += purchase.price * purchase.shares;
    totalShares += purchase.shares;
  });

  return totalShares > 0 ? totalCost / totalShares : 0;
}

/**
 * Calculate total portfolio value
 */
export function calculateTotalValue(shares: number, currentPrice: number): number {
  return shares * currentPrice;
}

/**
 * Calculate volatility (standard deviation of returns)
 */
export function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(ret);
  }

  // Calculate mean
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate variance
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

  // Return standard deviation (volatility)
  return Math.sqrt(variance) * 100; // Convert to percentage
}

/**
 * Check if sell signal should be triggered
 */
export function calculateSellSignal(
  returnRate: number,
  threshold: number
): boolean {
  return returnRate >= threshold;
}

/**
 * Calculate number of shares to purchase
 */
export function calculateSharesToPurchase(
  purchaseAmount: number,
  stockPrice: number
): number {
  if (stockPrice === 0) return 0;
  return purchaseAmount / stockPrice;
}

/**
 * Calculate new average price after purchase
 */
export function calculateNewAveragePrice(
  currentShares: number,
  currentAverage: number,
  newShares: number,
  newPrice: number
): number {
  const totalCost = currentShares * currentAverage + newShares * newPrice;
  const totalShares = currentShares + newShares;

  return totalShares > 0 ? totalCost / totalShares : 0;
}

/**
 * Calculate total invested amount
 */
export function calculateTotalInvested(purchases: DailyPurchase[]): number {
  return purchases.reduce(
    (total, purchase) => total + purchase.purchaseAmount,
    0
  );
}

/**
 * Calculate profit/loss amount
 */
export function calculateProfitLoss(
  totalValue: number,
  totalInvested: number
): number {
  return totalValue - totalInvested;
}

/**
 * Calculate shares to sell based on sell ratio
 */
export function calculateSharesToSell(
  totalShares: number,
  sellRatio: number
): number {
  return (totalShares * sellRatio) / 100;
}

/**
 * Calculate amount received from selling shares
 */
export function calculateSellAmount(
  shares: number,
  price: number
): number {
  return shares * price;
}

/**
 * Calculate week number from date
 */
export function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Calculate percentage change
 */
export function calculatePercentageChange(
  oldValue: number,
  newValue: number
): number {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate compound annual growth rate (CAGR)
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number {
  if (beginningValue === 0 || years === 0) return 0;
  return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
}

/**
 * Calculate sharpe ratio (risk-adjusted return)
 */
export function calculateSharpeRatio(
  averageReturn: number,
  riskFreeRate: number,
  standardDeviation: number
): number {
  if (standardDeviation === 0) return 0;
  return (averageReturn - riskFreeRate) / standardDeviation;
}
