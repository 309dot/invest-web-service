import type {
  Position,
  StockComparisonMetrics,
  StockComparisonPeriod,
  StockComparisonPoint,
  StockComparisonResponse,
  StockComparisonSeries,
} from '@/types';
import { assertCurrency, convertWithRate, getUsdKrwRate, type SupportedCurrency } from '@/lib/currency';

const PERIOD_CONFIG: Record<
  StockComparisonPeriod,
  { range: string; interval: string; label: string; minTradingDays: number }
> = {
  '1m': { range: '1mo', interval: '1d', label: '1개월', minTradingDays: 15 },
  '3m': { range: '3mo', interval: '1d', label: '3개월', minTradingDays: 40 },
  '6m': { range: '6mo', interval: '1d', label: '6개월', minTradingDays: 60 },
  '1y': { range: '1y', interval: '1d', label: '1년', minTradingDays: 120 },
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        currency?: string;
        exchangeName?: string;
        instrumentType?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
        }>;
        adjclose?: Array<{
          adjclose?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

type YahooSeries = {
  timestamps: number[];
  prices: number[];
  currency: SupportedCurrency;
};

type TargetSymbol = {
  symbol: string;
  displaySymbol: string;
  name: string;
  currency: SupportedCurrency;
  market: Position['market'] | 'BENCHMARK';
  isBenchmark: boolean;
};

const BENCHMARKS: Array<TargetSymbol & { id: string }> = [
  {
    id: 'KOSPI',
    symbol: '^KS11',
    displaySymbol: '^KS11',
    name: 'KOSPI',
    currency: 'KRW',
    market: 'BENCHMARK',
    isBenchmark: true,
  },
  {
    id: 'SNP_500',
    symbol: '^GSPC',
    displaySymbol: '^GSPC',
    name: 'S&P 500',
    currency: 'USD',
    market: 'BENCHMARK',
    isBenchmark: true,
  },
];

function mapPositionToTarget(position: Position): TargetSymbol | null {
  const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');

  if (!position.symbol) {
    return null;
  }

  let displaySymbol = position.symbol;
  if (position.market === 'KR') {
    const suffix = position.exchange?.toUpperCase().includes('KOSDAQ') ? '.KQ' : '.KS';
    displaySymbol = `${position.symbol}${suffix}`;
  }

  return {
    symbol: displaySymbol,
    displaySymbol,
    name: position.name ?? position.symbol,
    currency,
    market: position.market,
    isBenchmark: false,
  };
}

async function fetchYahooSeries(
  symbol: string,
  config: (typeof PERIOD_CONFIG)[StockComparisonPeriod]
): Promise<YahooSeries | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;

  const response = await fetch(`${url}?range=${config.range}&interval=${config.interval}&includePrePost=false`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (portfolio-analyzer)',
      Accept: 'application/json,text/plain,*/*',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    console.warn('[stockComparison] Yahoo Finance 요청 실패', symbol, response.status);
    return null;
  }

  const json = (await response.json()) as YahooChartResponse;
  const result = json?.chart?.result?.[0];

  if (!result?.timestamp || result.timestamp.length === 0) {
    console.warn('[stockComparison] Yahoo Finance 응답에 timestamp가 없습니다.', symbol);
    return null;
  }

  const adjClose = result.indicators?.adjclose?.[0]?.adjclose ?? null;
  const close = result.indicators?.quote?.[0]?.close ?? null;
  const pricesArray = adjClose ?? close;

  if (!pricesArray || pricesArray.length !== result.timestamp.length) {
    console.warn('[stockComparison] 가격 데이터와 타임스탬프 길이가 일치하지 않습니다.', symbol);
    return null;
  }

  const currency = assertCurrency(result.meta?.currency, 'USD');

  const prices: number[] = [];
  result.timestamp.forEach((ts, index) => {
    const price = pricesArray[index];
    if (price === null || price === undefined || Number.isNaN(price)) {
      prices.push(NaN);
    } else {
      prices.push(Number(price));
    }
  });

  return {
    timestamps: result.timestamp,
    prices,
    currency,
  };
}

function computeMetrics(points: StockComparisonPoint[]): StockComparisonMetrics {
  const validPoints = points.filter((point) => typeof point.price === 'number' && point.price !== null);
  if (validPoints.length < 2) {
    const price = validPoints[0]?.price ?? null;
    const returnPct = validPoints[0]?.returnPct ?? null;
    return {
      totalReturnPct: returnPct,
      annualizedReturnPct: returnPct,
      volatilityPct: null,
      sharpe: null,
      maxDrawdownPct: null,
      bestDayPct: null,
      worstDayPct: null,
      tradingDays: validPoints.length,
      startPrice: price,
      endPrice: price,
    };
  }

  const startPrice = validPoints[0].price ?? null;
  const endPrice = validPoints[validPoints.length - 1].price ?? null;
  const totalReturnPct =
    startPrice && endPrice ? ((endPrice / startPrice) - 1) * 100 : validPoints[validPoints.length - 1].returnPct ?? null;
  const tradingDays = validPoints.length;

  const prices = validPoints.map((point) => point.price as number);
  const returns = validPoints
    .map((point) => (typeof point.returnPct === 'number' ? point.returnPct : null))
    .filter((value): value is number => value !== null);

  const dailyReturns: number[] = [];
  for (let i = 1; i < prices.length; i += 1) {
    const prev = prices[i - 1];
    const current = prices[i];
    if (prev > 0 && current > 0) {
      dailyReturns.push((current / prev) - 1);
    }
  }

  let volatilityPct: number | null = null;
  let sharpe: number | null = null;
  let bestDayPct: number | null = null;
  let worstDayPct: number | null = null;

  if (dailyReturns.length > 1) {
    const avgDaily = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, value) => sum + (value - avgDaily) ** 2, 0) / (dailyReturns.length - 1);
    const stdDaily = Math.sqrt(Math.max(variance, 0));
    const annualizationFactor = Math.sqrt(252);

    volatilityPct = stdDaily * annualizationFactor * 100;
    sharpe = stdDaily > 0 ? (avgDaily * annualizationFactor) / stdDaily : null;
    bestDayPct = Math.max(...dailyReturns) * 100;
    worstDayPct = Math.min(...dailyReturns) * 100;
  }

  let maxDrawdownPct: number | null = null;
  const drawdowns: number[] = [];
  let peak = -Infinity;
  prices.forEach((price) => {
    if (price > peak) {
      peak = price;
    }
    if (peak > 0) {
      const drawdown = ((price - peak) / peak) * 100;
      drawdowns.push(drawdown);
    }
  });
  if (drawdowns.length > 0) {
    maxDrawdownPct = Math.min(...drawdowns);
  }

  let annualizedReturnPct: number | null = null;
  if (totalReturnPct !== null && tradingDays > 0) {
    const totalReturnDecimal = totalReturnPct / 100;
    const annualized = (1 + totalReturnDecimal) ** (252 / tradingDays) - 1;
    annualizedReturnPct = Number.isFinite(annualized) ? annualized * 100 : null;
  }

  return {
    totalReturnPct,
    annualizedReturnPct,
    volatilityPct,
    sharpe,
    maxDrawdownPct,
    bestDayPct,
    worstDayPct,
    tradingDays,
    startPrice,
    endPrice,
  };
}

function buildPoints(
  timestamps: number[],
  convertedPrices: Array<number | null>,
  normalizedReturns: Array<number | null>
): StockComparisonPoint[] {
  return timestamps.map((ts, index) => {
    const date = new Date(ts * 1000).toISOString().slice(0, 10);
    const price = convertedPrices[index];
    const returnPct = normalizedReturns[index];
    return {
      date,
      price: Number.isFinite(price ?? NaN) ? price : null,
      returnPct: Number.isFinite(returnPct ?? NaN) ? returnPct : null,
    };
  });
}

function normalizeReturns(prices: Array<number | null>): Array<number | null> {
  let base: number | null = null;
  return prices.map((price) => {
    if (price === null || Number.isNaN(price) || price <= 0) {
      return null;
    }
    if (base === null) {
      base = price;
    }
    if (base === 0) {
      return null;
    }
    return ((price / base) - 1) * 100;
  });
}

function convertPrices(
  prices: number[],
  from: SupportedCurrency,
  to: SupportedCurrency,
  fxRate: number
): Array<number | null> {
  return prices.map((price) => {
    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }
    return convertWithRate(price, from, to, fxRate);
  });
}

async function buildSeriesForTarget(
  target: TargetSymbol,
  period: StockComparisonPeriod,
  fxRate: number,
  baseCurrency: SupportedCurrency
): Promise<StockComparisonSeries | null> {
  const yahooSeries = await fetchYahooSeries(target.symbol, PERIOD_CONFIG[period]);
  if (!yahooSeries) {
    return null;
  }

  const convertedPrices = convertPrices(yahooSeries.prices, target.currency, baseCurrency, fxRate);
  const normalized = normalizeReturns(convertedPrices);
  const points = buildPoints(yahooSeries.timestamps, convertedPrices, normalized);

  const basePrice = points.find((point) => point.price !== null)?.price ?? null;
  const latestPrice = [...points].reverse().find((point) => point.price !== null)?.price ?? null;
  const latestReturnPct = [...points].reverse().find((point) => point.returnPct !== null)?.returnPct ?? null;

  const metrics = computeMetrics(points);

  return {
    symbol: target.symbol,
    name: target.name,
    currency: target.currency,
    market: target.market,
    isBenchmark: target.isBenchmark,
    basePrice,
    latestPrice,
    latestReturnPct,
    data: points,
    metrics,
  };
}

export async function getStockComparisonData(options: {
  positions: Position[];
  period: StockComparisonPeriod;
  includeBenchmarks?: boolean;
  baseCurrency?: SupportedCurrency;
  limit?: number;
}): Promise<StockComparisonResponse> {
  const { positions, period, includeBenchmarks = true, baseCurrency = 'KRW', limit = 6 } = options;
  const config = PERIOD_CONFIG[period] ?? PERIOD_CONFIG['3m'];

  const { rate } = await getUsdKrwRate();

  const selectedPositions = positions
    .slice()
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit)
    .map(mapPositionToTarget)
    .filter((target): target is TargetSymbol => Boolean(target));

  const targets: TargetSymbol[] = [...selectedPositions];

  if (includeBenchmarks) {
    BENCHMARKS.forEach((benchmark) => {
      if (!targets.some((item) => item.symbol === benchmark.symbol)) {
        targets.push(benchmark);
      }
    });
  }

  const series = (
    await Promise.all(
      targets.map((target) => buildSeriesForTarget(target, period, rate, baseCurrency))
    )
  ).filter((item): item is StockComparisonSeries => Boolean(item));

  const filteredSeries = series.filter((item) => item.metrics.tradingDays >= config.minTradingDays);

  return {
    success: true,
    period,
    baseCurrency,
    includeBenchmarks,
    series: filteredSeries,
    generatedAt: new Date().toISOString(),
    meta: {
      totalRequested: targets.length,
      totalReturned: filteredSeries.length,
      fxRate: rate,
      periodLabel: config.label,
      minTradingDays: config.minTradingDays,
    },
  };
}

