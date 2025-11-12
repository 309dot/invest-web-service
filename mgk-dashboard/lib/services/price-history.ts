import axios from 'axios';

export interface DailyPricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

interface PriceSeriesCacheItem {
  start: string;
  end: string;
  points: DailyPricePoint[];
}

const priceSeriesCache = new Map<string, PriceSeriesCacheItem>();

function normalizeSymbolKey(symbol: string): string {
  return symbol?.trim().toUpperCase();
}

function buildYahooSymbolCandidates(symbol: string, market?: 'US' | 'KR' | 'GLOBAL'): string[] {
  const normalized = normalizeSymbolKey(symbol);

  if (normalized.includes('.')) {
    return [normalized];
  }

  if (market === 'KR') {
    return [`${normalized}.KS`, `${normalized}.KQ`];
  }

  return [normalized];
}

function toUnixTimestamp(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

function toDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchYahooSeries(
  candidate: string,
  start: number,
  end: number
): Promise<DailyPricePoint[] | null> {
  try {
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${candidate}`,
      {
        params: {
          interval: '1d',
          period1: start,
          period2: end,
        },
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PriceHistoryFetcher/1.0)',
          Accept: 'application/json,text/plain,*/*',
        },
      }
    );

    const result = response.data?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
      return null;
    }

    const quotes = result.indicators?.adjclose?.[0]?.adjclose ?? result.indicators?.quote?.[0]?.close;
    if (!Array.isArray(quotes)) {
      return null;
    }

    const points: DailyPricePoint[] = [];
    for (let i = 0; i < result.timestamp.length; i += 1) {
      const timestamp = result.timestamp[i];
      const close = quotes[i];
      if (!Number.isFinite(close)) {
        continue;
      }
      points.push({
        date: toDateString(timestamp),
        close,
      });
    }
    return points.length > 0 ? points : null;
  } catch (error) {
    return null;
  }
}

function mergeSeries(existing: DailyPricePoint[], incoming: DailyPricePoint[]): DailyPricePoint[] {
  const map = new Map<string, number>();
  existing.forEach((point) => {
    map.set(point.date, point.close);
  });
  incoming.forEach((point) => {
    map.set(point.date, point.close);
  });
  return Array.from(map.entries())
    .map(([date, close]) => ({ date, close }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export async function getPriceSeries(
  symbol: string,
  market: 'US' | 'KR' | 'GLOBAL' | undefined,
  startDate: string
): Promise<PriceSeriesCacheItem | null> {
  const normalizedSymbol = normalizeSymbolKey(symbol);
  const cacheKey = `${normalizedSymbol}:${market ?? 'GLOBAL'}`;
  const endDate = new Date();

  const start = new Date(`${startDate}T00:00:00Z`);
  const startSeconds = toUnixTimestamp(start);
  const endSeconds = toUnixTimestamp(new Date(endDate.getTime() + 48 * 60 * 60 * 1000)); // add buffer

  const cached = priceSeriesCache.get(cacheKey);
  if (cached && cached.start <= startDate) {
    return cached;
  }

  const candidates = buildYahooSymbolCandidates(symbol, market);
  for (const candidate of candidates) {
    const series = await fetchYahooSeries(candidate, startSeconds, endSeconds);
    if (series && series.length > 0) {
      const points = cached ? mergeSeries(cached.points, series) : series;
      const updated: PriceSeriesCacheItem = {
        start: points[0]?.date ?? startDate,
        end: points[points.length - 1]?.date ?? startDate,
        points,
      };
      priceSeriesCache.set(cacheKey, updated);
      return updated;
    }
  }

  return cached ?? null;
}

export function getPriceOnOrBefore(
  series: PriceSeriesCacheItem | null,
  targetDate: string
): { date: string | null; price: number | null } {
  if (!series) {
    return { date: null, price: null };
  }

  for (let i = series.points.length - 1; i >= 0; i -= 1) {
    const point = series.points[i];
    if (point.date <= targetDate && Number.isFinite(point.close)) {
      return { date: point.date, price: point.close };
    }
  }
  return { date: null, price: null };
}

export function getMostRecentPrice(series: PriceSeriesCacheItem | null): {
  date: string | null;
  price: number | null;
} {
  if (!series || series.points.length === 0) {
    return { date: null, price: null };
  }
  const last = series.points[series.points.length - 1];
  return { date: last.date, price: Number.isFinite(last.close) ? last.close : null };
}

