import { Timestamp } from 'firebase/firestore';
import { addDocument, getDocumentsByDateRange } from '@/lib/firestore';
import { calculateVolatility } from '@/lib/utils/calculations';
import { DailyPurchase, WeeklyReport, WeeklySummary } from '@/types';

export async function generateWeeklySummary(startDate: string, endDate: string) {
  const purchases = await getDocumentsByDateRange<DailyPurchase>('dailyPurchases', 'date', startDate, endDate);

  if (!purchases.length) {
    return null;
  }

  const totalInvested = purchases.reduce((sum, item) => sum + (item.purchaseAmount ?? 0), 0);
  const totalValue = purchases[purchases.length - 1]?.totalValue ?? 0;
  const averagePrice = purchases.reduce((sum, item) => sum + item.price, 0) / purchases.length;
  const returnRate = purchases[purchases.length - 1]?.returnRate ?? 0;
  const prices = purchases.map((item) => item.price);
  const volatility = calculateVolatility(prices);

  return {
    totalInvested,
    totalValue,
    averagePrice,
    returnRate,
    volatility,
    highestPrice: Math.max(...prices),
    lowestPrice: Math.min(...prices),
  };
}

export async function saveWeeklyReport(summary: WeeklySummary, newsHighlights: string[] = []) {
  const report: WeeklyReport = {
    week: summary.week,
    period: summary.period,
    weeklyReturn: summary.returnRate,
    highPrice: summary.highestPrice,
    lowPrice: summary.lowestPrice,
    volatility: summary.volatility,
    topNews: newsHighlights.map((title) => ({ title, link: '', importance: 'Medium' })),
    learningPoints: [],
    generatedAt: Timestamp.now(),
  };

  await addDocument<WeeklyReport>('weeklyReports', report);
  return report;
}
