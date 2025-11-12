import { subDays, subMonths, subYears, startOfYear, formatISO } from 'date-fns';
import type { Position, Transaction } from '@/types';
import { getPortfolioTransactions } from '@/lib/services/transaction';
import { assertCurrency, convertWithRate, type SupportedCurrency } from '@/lib/currency';
import { getPriceSeries, getPriceOnOrBefore, getMostRecentPrice } from '@/lib/services/price-history';

export type PerformancePeriodKey = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export interface PeriodPerformance {
  period: PerformancePeriodKey;
  startDate: string;
  effectiveStartDate: string | null;
  endDate: string;
  endValue: number;
  startValue: number;
  absoluteChange: number;
  returnRate: number | null;
}

export interface BenchmarkDefinition {
  id: string;
  name: string;
  symbol: string;
  market: 'US' | 'KR';
  currency: SupportedCurrency;
}

export interface BenchmarkPeriodPerformance extends PeriodPerformance {
  benchmarkId: string;
  benchmarkName: string;
  symbol: string;
  currency: SupportedCurrency;
}

export interface PositionPerformanceSeries {
  symbol: string;
  currency: SupportedCurrency;
  series: Array<{
    date: string;
    price: number;
  }>;
}

export interface PortfolioPerformanceResult {
  periods: Record<PerformancePeriodKey, PeriodPerformance>;
  benchmarks: BenchmarkPeriodPerformance[];
  latestValuationDate: string | null;
  currentValue: number;
  positionSeries: PositionPerformanceSeries[];
}

const BENCHMARKS: BenchmarkDefinition[] = [
  {
    id: 'kospi',
    name: 'KOSPI',
    symbol: '^KS11',
    market: 'KR',
    currency: 'KRW',
  },
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: '^GSPC',
    market: 'US',
    currency: 'USD',
  },
];

function normalizeDate(date: Date): string {
  return formatISO(date, { representation: 'date' });
}

function computePeriodStartDate(
  period: PerformancePeriodKey,
  today: Date,
  earliestAvailable: string
): string {
  switch (period) {
    case '1D':
      return normalizeDate(subDays(today, 1));
    case '1W':
      return normalizeDate(subDays(today, 7));
    case '1M':
      return normalizeDate(subMonths(today, 1));
    case '3M':
      return normalizeDate(subMonths(today, 3));
    case 'YTD':
      return normalizeDate(startOfYear(today));
    case '1Y':
      return normalizeDate(subYears(today, 1));
    case 'ALL':
    default:
      return earliestAvailable;
  }
}

function calculateSharesAt(transactions: Transaction[], targetDate: string): number {
  let shares = 0;
  for (const tx of transactions) {
    if (tx.date <= targetDate) {
      const quantity = Number(tx.shares) || 0;
      if (tx.type === 'buy') {
        shares += quantity;
      } else if (tx.type === 'sell') {
        shares -= quantity;
      }
    }
  }
  return shares;
}

interface SymbolContext {
  market: Position['market'];
  currency: SupportedCurrency;
  shares: number;
}

export async function calculatePortfolioPerformance(params: {
  userId: string;
  portfolioId: string;
  positions: Position[];
  fxRate: number | null;
}): Promise<PortfolioPerformanceResult> {
  const { userId, portfolioId, positions, fxRate } = params;
  const transactions = await getPortfolioTransactions(userId, portfolioId);
  const sortedTransactions = [...transactions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const earliestTransactionDate =
    sortedTransactions.length > 0 ? sortedTransactions[0].date : normalizeDate(new Date());
  const today = new Date();
  const todayDate = normalizeDate(today);

  const periodKeys: PerformancePeriodKey[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];
  const periodStartDates = new Map<PerformancePeriodKey, string>();

  periodKeys.forEach((period) => {
    const start = computePeriodStartDate(period, today, earliestTransactionDate);
    const effectiveStart = start < earliestTransactionDate ? earliestTransactionDate : start;
    periodStartDates.set(period, effectiveStart);
  });

  const globalEarliestStart = Array.from(periodStartDates.values()).reduce(
    (min, current) => (current < min ? current : min),
    earliestTransactionDate
  );

  const transactionsBySymbol = new Map<string, Transaction[]>();
  sortedTransactions.forEach((tx) => {
    const key = tx.symbol;
    if (!key) return;
    const list = transactionsBySymbol.get(key) ?? [];
    list.push(tx);
    transactionsBySymbol.set(key, list);
  });

  const symbolContext = new Map<string, SymbolContext>();
  positions.forEach((position) => {
    symbolContext.set(position.symbol, {
      market: position.market,
      currency: assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD'),
      shares: position.shares,
    });
  });

  const priceSeriesBySymbol = new Map<string, Awaited<ReturnType<typeof getPriceSeries>>>();
  for (const position of positions) {
    const series = await getPriceSeries(position.symbol, position.market, globalEarliestStart);
    priceSeriesBySymbol.set(position.symbol, series);
  }

  const convertToUsd = (amount: number, currency: SupportedCurrency): number => {
    if (!Number.isFinite(amount)) {
      return 0;
    }
    if (currency === 'USD') {
      return amount;
    }
    if (!fxRate || fxRate <= 0) {
      return amount;
    }
    return convertWithRate(amount, 'KRW', 'USD', fxRate);
  };

  let currentValue = 0;
  let latestValuationDate: string | null = null;

  positions.forEach((position) => {
    const context = symbolContext.get(position.symbol);
    if (!context) return;
    const series = priceSeriesBySymbol.get(position.symbol);
    const mostRecent = getMostRecentPrice(series ?? null);
    const price = Number.isFinite(position.currentPrice) && position.currentPrice! > 0
      ? position.currentPrice
      : mostRecent.price ?? null;
    if (!price || price <= 0) {
      return;
    }
    if (mostRecent.date) {
      if (!latestValuationDate || mostRecent.date > latestValuationDate) {
        latestValuationDate = mostRecent.date;
      }
    }
    const valueLocal = context.shares * price;
    currentValue += convertToUsd(valueLocal, context.currency);
  });

  const periodResults: Record<PerformancePeriodKey, PeriodPerformance> = {} as Record<
    PerformancePeriodKey,
    PeriodPerformance
  >;

  periodKeys.forEach((period) => {
    const startDate = periodStartDates.get(period) ?? earliestTransactionDate;
    let startValue = 0;

    positions.forEach((position) => {
      const context = symbolContext.get(position.symbol);
      if (!context) return;

      const txList = transactionsBySymbol.get(position.symbol) ?? [];
      const sharesAtStart = calculateSharesAt(txList, startDate);
      if (sharesAtStart <= 0) {
        return;
      }
      const series = priceSeriesBySymbol.get(position.symbol);
      const priceInfo = getPriceOnOrBefore(series ?? null, startDate);
      const price = priceInfo.price;
      if (!price || price <= 0) {
        return;
      }
      const valueLocal = sharesAtStart * price;
      startValue += convertToUsd(valueLocal, context.currency);
    });

    const absoluteChange = currentValue - startValue;
    const returnRate = startValue > 0 ? (absoluteChange / startValue) * 100 : null;

    periodResults[period] = {
      period,
      startDate,
      effectiveStartDate: startValue > 0 ? startDate : null,
      endDate: todayDate,
      endValue: currentValue,
      startValue,
      absoluteChange,
      returnRate,
    };
  });

  const benchmarkResults: BenchmarkPeriodPerformance[] = [];

  const positionSeries: PositionPerformanceSeries[] = [];
  positions.forEach((position) => {
    const series = priceSeriesBySymbol.get(position.symbol);
    if (!series || !series.points || series.points.length === 0) {
      return;
    }
    const maxPoints = 180;
    const sliced = series.points.slice(-maxPoints);
    const context = symbolContext.get(position.symbol);
    positionSeries.push({
      symbol: position.symbol,
      currency: context?.currency ?? 'USD',
      series: sliced.map((point) => ({
        date: point.date,
        price: point.close,
      })),
    });
  });

  for (const benchmark of BENCHMARKS) {
    const series = await getPriceSeries(benchmark.symbol, benchmark.market, globalEarliestStart);
    const mostRecent = getMostRecentPrice(series);
    const benchmarkEndPrice = mostRecent.price;
    const benchmarkEndDate = mostRecent.date ?? todayDate;
    if (!benchmarkEndPrice || benchmarkEndPrice <= 0) {
      continue;
    }

    periodKeys.forEach((period) => {
      const startDate = periodStartDates.get(period) ?? earliestTransactionDate;
      const priceInfo = getPriceOnOrBefore(series, startDate);
      const startPrice = priceInfo.price;
      const effectiveStart = priceInfo.date ?? startDate;
      if (!startPrice || startPrice <= 0) {
        benchmarkResults.push({
          benchmarkId: benchmark.id,
          benchmarkName: benchmark.name,
          symbol: benchmark.symbol,
          currency: benchmark.currency,
          period,
          startDate,
          effectiveStartDate: null,
          endDate: benchmarkEndDate,
          endValue: benchmarkEndPrice,
          startValue: 0,
          absoluteChange: 0,
          returnRate: null,
        });
        return;
      }
      const absoluteChange = benchmarkEndPrice - startPrice;
      const returnRate = (absoluteChange / startPrice) * 100;
      benchmarkResults.push({
        benchmarkId: benchmark.id,
        benchmarkName: benchmark.name,
        symbol: benchmark.symbol,
        currency: benchmark.currency,
        period,
        startDate,
        effectiveStartDate: effectiveStart,
        endDate: benchmarkEndDate,
        endValue: benchmarkEndPrice,
        startValue: startPrice,
        absoluteChange,
        returnRate,
      });
    });
  }

  return {
    periods: periodResults,
    benchmarks: benchmarkResults,
    latestValuationDate,
    currentValue,
    positionSeries,
  };
}

