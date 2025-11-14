import axios from 'axios';
import { subYears, isValid, parseISO, differenceInDays, max as maxDate } from 'date-fns';

type SupportedCurrency = 'USD' | 'KRW';

export type BenchmarkId = 'KOSPI' | 'SNP_500' | 'GLOBAL_60_40';

export interface BenchmarkResult {
  id: BenchmarkId;
  name: string;
  symbol: string;
  currency: SupportedCurrency;
  returnRate: number | null;
  since: string;
  lastPrice: number | null;
  source: 'yahoo' | 'cache' | 'fallback';
  note?: string;
}

interface YahooSeriesEntry {
  date: string;
  close: number;
}

interface YahooSeries {
  start: YahooSeriesEntry | null;
  end: YahooSeriesEntry | null;
  source: 'yahoo' | 'cache' | 'fallback';
}

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (PortfolioBenchmarkBot/1.0)',
};

const SERIES_CACHE = new Map<string, { data: YahooSeries; timestamp: number }>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30분

function toUnixTime(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function normalizeDateString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function buildYahooSeriesCacheKey(symbol: string, start: string, end: string): string {
  return `${symbol}:${start}:${end}`;
}

function locateFirstValid(entries: YahooSeriesEntry[], predicate: (entry: YahooSeriesEntry) => boolean): YahooSeriesEntry | null {
  for (let i = 0; i < entries.length; i += 1) {
    if (predicate(entries[i])) {
      return entries[i];
    }
  }
  return null;
}

function locateLastValid(entries: YahooSeriesEntry[]): YahooSeriesEntry | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (Number.isFinite(entries[i].close) && entries[i].close > 0) {
      return entries[i];
    }
  }
  return null;
}

async function fetchYahooSeries(symbol: string, startDate: string, endDate: string): Promise<YahooSeries> {
  const cacheKey = buildYahooSeriesCacheKey(symbol, startDate, endDate);
  const cached = SERIES_CACHE.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const response = await axios.get(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
    {
      params: {
        period1: toUnixTime(start),
        period2: toUnixTime(end),
        interval: '1d',
        includeAdjustedClose: true,
      },
      timeout: 10000,
      headers: REQUEST_HEADERS,
    }
  );

  const result = response.data?.chart?.result?.[0];
  if (!result || !Array.isArray(result.timestamp) || !result.indicators?.quote?.[0]?.close) {
    const fallback: YahooSeries = { start: null, end: null, source: 'fallback' };
    SERIES_CACHE.set(cacheKey, { data: fallback, timestamp: Date.now() });
    return fallback;
  }

  const entries: YahooSeriesEntry[] = result.timestamp
    .map((timestamp: number, index: number) => {
      const close = result.indicators.quote[0].close?.[index];
      if (!Number.isFinite(close) || close <= 0) {
        return null;
      }
      return {
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        close,
      };
    })
    .filter((entry: YahooSeriesEntry | null): entry is YahooSeriesEntry => Boolean(entry));

  const first = locateFirstValid(entries, (entry) => entry.date >= startDate);
  const last = locateLastValid(entries);

  const series: YahooSeries = {
    start: first,
    end: last,
    source: 'yahoo',
  };

  SERIES_CACHE.set(cacheKey, { data: series, timestamp: Date.now() });
  return series;
}

function computeReturnRate(start: YahooSeriesEntry | null, end: YahooSeriesEntry | null): number | null {
  if (!start || !end || !Number.isFinite(start.close) || !Number.isFinite(end.close) || start.close <= 0) {
    return null;
  }

  return ((end.close - start.close) / start.close) * 100;
}

async function getBenchmarkReturn(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<{ returnRate: number | null; since: string; lastPrice: number | null; source: 'yahoo' | 'cache' | 'fallback' }> {
  try {
    const series = await fetchYahooSeries(symbol, startDate, endDate);
    const returnRate = computeReturnRate(series.start, series.end);

    return {
      returnRate,
      since: series.start?.date ?? startDate,
      lastPrice: series.end?.close ?? null,
      source: series.source,
    };
  } catch (error) {
    console.error('[benchmark] Failed to fetch Yahoo series', { symbol, startDate, endDate, error });
    return {
      returnRate: null,
      since: startDate,
      lastPrice: null,
      source: 'fallback',
    };
  }
}

export async function getBenchmarkComparisons(options: {
  startDate?: string;
  endDate?: string;
}): Promise<BenchmarkResult[]> {
  const today = new Date();
  const defaultStart = subYears(today, 1);

  const normalizedStart = normalizeDateString(options.startDate) ?? defaultStart.toISOString().slice(0, 10);
  const normalizedEnd = normalizeDateString(options.endDate) ?? today.toISOString().slice(0, 10);

  const effectiveStart = differenceInDays(parseISO(normalizedEnd), parseISO(normalizedStart)) < 30
    ? subYears(parseISO(normalizedEnd), 1).toISOString().slice(0, 10)
    : normalizedStart;

  const targets: Array<{
    id: BenchmarkId;
    name: string;
    symbol: string;
    currency: SupportedCurrency;
    compute?: () => Promise<BenchmarkResult>;
  }> = [
    {
      id: 'KOSPI',
      name: 'KOSPI',
      symbol: '^KS11',
      currency: 'KRW',
    },
    {
      id: 'SNP_500',
      name: 'S&P 500',
      symbol: '^GSPC',
      currency: 'USD',
    },
    {
      id: 'GLOBAL_60_40',
      name: '60/40 글로벌 포트폴리오',
      symbol: '0.6*^GSPC + 0.4*BND',
      currency: 'USD',
      compute: async () => {
        const [equity, bond] = await Promise.all([
          getBenchmarkReturn('^GSPC', effectiveStart, normalizedEnd),
          getBenchmarkReturn('BND', effectiveStart, normalizedEnd),
        ]);

        const equityReturn = equity.returnRate ?? 0;
        const bondReturn = bond.returnRate ?? 0;
        const hasData = equity.returnRate !== null || bond.returnRate !== null;
        return {
          id: 'GLOBAL_60_40',
          name: '60/40 글로벌 포트폴리오',
          symbol: '0.6×S&P 500 + 0.4×BND',
          currency: 'USD',
          returnRate: hasData ? (equityReturn * 0.6) + (bondReturn * 0.4) : null,
          since: maxDate([
            parseISO(equity.since),
            parseISO(bond.since),
            parseISO(effectiveStart),
          ]).toISOString().slice(0, 10),
          lastPrice: null,
          source: equity.source === 'yahoo' && bond.source === 'yahoo' ? 'yahoo' : 'fallback',
          note: equity.returnRate === null || bond.returnRate === null
            ? '구성 지수 중 일부 데이터가 부족하여 추정값으로 계산되었습니다.'
            : undefined,
        };
      },
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const target of targets) {
    if (target.compute) {
      results.push(await target.compute());
      continue;
    }

    const data = await getBenchmarkReturn(target.symbol, effectiveStart, normalizedEnd);
    results.push({
      id: target.id,
      name: target.name,
      symbol: target.symbol,
      currency: target.currency,
      returnRate: data.returnRate,
      since: data.since,
      lastPrice: data.lastPrice,
      source: data.source,
    });
  }

  return results;
}

