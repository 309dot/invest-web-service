import { differenceInCalendarDays, parseISO, isValid, startOfYear, subDays, subMonths, subYears } from 'date-fns';
import { getDocumentsWithLimit } from '@/lib/firestore';
import type { DailyPurchase, PortfolioPerformancePeriod, PortfolioPerformancePeriodId } from '@/types';

type ExtendedDailyPurchase = DailyPurchase & {
  parsedDate: Date;
  invested: number | null;
};

const MAX_DAILY_RECORDS = 1500;

const PERIOD_CONFIGS: Array<{
  id: PortfolioPerformancePeriodId;
  label: string;
  resolveStart: (endDate: Date, timeline: ExtendedDailyPurchase[]) => ExtendedDailyPurchase | null;
}> = [
  {
    id: '1D',
    label: '1일',
    resolveStart: (end, timeline) => findClosestEntry(timeline, subDays(end, 1)),
  },
  {
    id: '1W',
    label: '1주',
    resolveStart: (end, timeline) => findClosestEntry(timeline, subDays(end, 7)),
  },
  {
    id: '1M',
    label: '1개월',
    resolveStart: (end, timeline) => findClosestEntry(timeline, subMonths(end, 1)),
  },
  {
    id: '3M',
    label: '3개월',
    resolveStart: (end, timeline) => findClosestEntry(timeline, subMonths(end, 3)),
  },
  {
    id: 'YTD',
    label: 'YTD',
    resolveStart: (end, timeline) => findClosestEntry(timeline, startOfYear(end)),
  },
  {
    id: '1Y',
    label: '1년',
    resolveStart: (end, timeline) => findClosestEntry(timeline, subYears(end, 1)),
  },
  {
    id: 'ALL',
    label: '전체',
    resolveStart: (_end, timeline) => (timeline.length ? timeline[0] : null),
  },
];

interface PerformanceFetchOptions {
  userId?: string | null;
  portfolioId?: string | null;
}

export async function getPortfolioPerformancePeriods(
  options: PerformanceFetchOptions = {}
): Promise<PortfolioPerformancePeriod[]> {
  const { userId, portfolioId } = options;
  let rawRecords: DailyPurchase[] = [];

  if (userId && portfolioId) {
    rawRecords = await getDocumentsWithLimit<DailyPurchase>(
      `users/${userId}/portfolios/${portfolioId}/dailySnapshots`,
      MAX_DAILY_RECORDS,
      'date',
      'asc'
    ).catch(() => []);
  }

  if (!rawRecords.length) {
    rawRecords = await getDocumentsWithLimit<DailyPurchase>(
      'dailyPurchases',
      MAX_DAILY_RECORDS,
      'date',
      'asc'
    ).catch(() => []);
  }

  if (!rawRecords.length) {
    return [];
  }

  const timeline = rawRecords
    .map((record) => enrichDailyPurchase(record))
    .filter((item): item is ExtendedDailyPurchase => !!item)
    .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  if (!timeline.length) {
    return [];
  }

  const latest = timeline[timeline.length - 1];

  return PERIOD_CONFIGS.map((config) => {
    const startEntry = config.resolveStart(latest.parsedDate, timeline) ?? timeline[0];
    const periodEntries = timeline.filter(
      (entry) => entry.parsedDate >= startEntry.parsedDate && entry.parsedDate <= latest.parsedDate
    );

    return buildPerformancePeriod(config.id, config.label, startEntry, latest, periodEntries);
  });
}

function enrichDailyPurchase(record: DailyPurchase): ExtendedDailyPurchase | null {
  if (!record?.date) {
    return null;
  }

  const parsed = parseISO(record.date);
  if (!isValid(parsed)) {
    return null;
  }

  const invested = inferInvestedAmount(record);

  return {
    ...record,
    parsedDate: parsed,
    invested,
  };
}

function inferInvestedAmount(record: DailyPurchase): number | null {
  const totalValue = Number(record.totalValue ?? NaN);
  const totalShares = Number(record.totalShares ?? NaN);
  const averagePrice = Number(record.averagePrice ?? NaN);
  const returnRate = Number(record.returnRate ?? NaN);

  if (Number.isFinite(totalShares) && totalShares > 0 && Number.isFinite(averagePrice) && averagePrice > 0) {
    return totalShares * averagePrice;
  }

  if (Number.isFinite(totalValue) && Number.isFinite(returnRate) && returnRate !== -100) {
    const denominator = 1 + returnRate / 100;
    if (denominator !== 0) {
      return totalValue / denominator;
    }
  }

  return Number.isFinite(totalValue) ? totalValue : null;
}

function findClosestEntry(timeline: ExtendedDailyPurchase[], threshold: Date): ExtendedDailyPurchase | null {
  const candidates = timeline.filter((entry) => entry.parsedDate <= threshold);
  if (candidates.length) {
    return candidates[candidates.length - 1];
  }

  const fallback = timeline.find((entry) => entry.parsedDate >= threshold);
  return fallback ?? (timeline.length ? timeline[0] : null);
}

function buildPerformancePeriod(
  id: PortfolioPerformancePeriodId,
  label: string,
  start: ExtendedDailyPurchase,
  end: ExtendedDailyPurchase,
  samples: ExtendedDailyPurchase[]
): PortfolioPerformancePeriod {
  const startValue = sanitizeNumber(start.totalValue);
  const endValue = sanitizeNumber(end.totalValue);
  const startInvested = sanitizeNumber(start.invested);
  const endInvested = sanitizeNumber(end.invested);

  const absoluteReturn =
    startValue !== null && endValue !== null ? roundNumber(endValue - startValue) : null;

  const totalReturn =
    startValue !== null && startValue > 0 && endValue !== null
      ? roundNumber(((endValue - startValue) / startValue) * 100)
      : null;

  const rawDays = differenceInCalendarDays(end.parsedDate, start.parsedDate);
  const periodDays = Math.max(1, rawDays + 1);

  const annualizedReturn =
    totalReturn !== null && startValue !== null && startValue > 0 && endValue !== null && endValue > 0 && rawDays > 0
      ? roundNumber((Math.pow(endValue / startValue, 365 / rawDays) - 1) * 100)
      : null;

  const investedChange =
    startInvested !== null && endInvested !== null ? roundNumber(endInvested - startInvested) : null;

  const {
    cumulativeGain,
    cumulativeLoss,
    bestDayReturn,
    worstDayReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
  } = calculatePerformanceStatistics(samples);

  return {
    id,
    label,
    startDate: start.date,
    endDate: end.date,
    periodDays,
    sampleCount: samples.length,
    startValue,
    endValue,
    absoluteReturn,
    totalReturn,
    annualizedReturn,
    startInvested,
    endInvested,
    investedChange,
    source: samples.length > 0 ? 'dailyPurchases' : 'insufficient-data',
    cumulativeGain,
    cumulativeLoss,
    bestDayReturn,
    worstDayReturn,
    volatility,
    sharpeRatio,
    maxDrawdown,
    note: samples.length < 2 ? '데이터 표본이 충분하지 않습니다.' : undefined,
  };
}

function sanitizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function roundNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

function calculatePerformanceStatistics(samples: ExtendedDailyPurchase[]) {
  if (samples.length < 2) {
    return {
      cumulativeGain: null,
      cumulativeLoss: null,
      bestDayReturn: null,
      worstDayReturn: null,
      volatility: null,
      sharpeRatio: null,
      maxDrawdown: null,
    };
  }

  const validValues = samples
    .map((entry) => sanitizeNumber(entry.totalValue))
    .filter((value): value is number => value !== null);

  if (validValues.length < 2) {
    return {
      cumulativeGain: null,
      cumulativeLoss: null,
      bestDayReturn: null,
      worstDayReturn: null,
      volatility: null,
      sharpeRatio: null,
      maxDrawdown: null,
    };
  }

  let lastValue: number | null = null;
  let peakValue: number | null = null;
  let minDrawdown: number | null = null;
  let cumulativeGain = 0;
  let cumulativeLoss = 0;
  let bestDay: number | null = null;
  let worstDay: number | null = null;
  const dailyReturns: number[] = [];

  samples.forEach((entry) => {
    const currentValue = sanitizeNumber(entry.totalValue);
    if (currentValue === null) {
      return;
    }

    if (lastValue !== null) {
      const diff = currentValue - lastValue;
      if (diff >= 0) {
        cumulativeGain += diff;
      } else {
        cumulativeLoss += diff;
      }

      if (lastValue > 0) {
        const returnPercent = ((currentValue - lastValue) / lastValue) * 100;
        if (Number.isFinite(returnPercent)) {
          dailyReturns.push(returnPercent);
          bestDay = bestDay === null ? returnPercent : Math.max(bestDay, returnPercent);
          worstDay = worstDay === null ? returnPercent : Math.min(worstDay, returnPercent);
        }
      }
    }

    if (peakValue === null || currentValue > peakValue) {
      peakValue = currentValue;
    }
    if (peakValue && peakValue > 0) {
      const drawdown = ((currentValue - peakValue) / peakValue) * 100;
      minDrawdown = minDrawdown === null ? drawdown : Math.min(minDrawdown, drawdown);
    }

    lastValue = currentValue;
  });

  const volatility =
    dailyReturns.length > 1 ? roundNumber(calculateStandardDeviation(dailyReturns)) : null;
  const sharpeRatio =
    dailyReturns.length > 1 ? roundNumber(calculateSharpeRatio(dailyReturns)) : null;

  return {
    cumulativeGain: roundNumber(cumulativeGain),
    cumulativeLoss: roundNumber(cumulativeLoss),
    bestDayReturn: bestDay !== null ? roundNumber(bestDay) : null,
    worstDayReturn: worstDay !== null ? roundNumber(worstDay) : null,
    volatility,
    sharpeRatio,
    maxDrawdown: minDrawdown !== null ? roundNumber(minDrawdown) : null,
  };
}

function calculateStandardDeviation(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateSharpeRatio(dailyReturnPercents: number[]): number {
  if (!dailyReturnPercents.length) {
    return 0;
  }
  const dailyReturns = dailyReturnPercents.map((value) => value / 100);
  const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dailyReturns.length;
  const std = Math.sqrt(variance);

  if (std === 0) {
    return 0;
  }

  const annualizedReturn = mean * 365;
  const annualizedVolatility = std * Math.sqrt(365);
  if (annualizedVolatility === 0) {
    return 0;
  }
  return annualizedReturn / annualizedVolatility;
}

