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

export async function getPortfolioPerformancePeriods(): Promise<PortfolioPerformancePeriod[]> {
  const rawRecords = await getDocumentsWithLimit<DailyPurchase>(
    'dailyPurchases',
    MAX_DAILY_RECORDS,
    'date',
    'asc'
  ).catch(() => []);

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

