import type {
  CorrelationMatrixResponse,
  CorrelationSymbol,
  Position,
  StockComparisonPeriod,
} from '@/types';
import { getStockComparisonData } from './stockComparison';

function computeCorrelation(a: Array<number | null>, b: Array<number | null>): number | null {
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      xs.push(x);
      ys.push(y);
    }
  }

  const n = xs.length;
  if (n < 2) {
    return null;
  }

  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX <= 0 || varY <= 0) {
    return null;
  }

  const denom = Math.sqrt(varX) * Math.sqrt(varY);
  if (denom === 0) {
    return null;
  }

  return cov / denom;
}

function buildReturnSeries(
  data: { date: string; price: number | null }[],
  dates: string[]
): Array<number | null> {
  const pointMap = new Map<string, number>();
  data.forEach((point) => {
    if (point.price !== null && Number.isFinite(point.price)) {
      pointMap.set(point.date, point.price);
    }
  });

  const returns: Array<number | null> = [];
  let prevPrice: number | null = null;

  dates.forEach((date) => {
    const price = pointMap.get(date) ?? null;
    if (price !== null && price > 0) {
      if (prevPrice !== null && prevPrice > 0) {
        const ret = price / prevPrice - 1;
        returns.push(Number.isFinite(ret) ? ret : null);
      } else {
        returns.push(null);
      }
      prevPrice = price;
    } else {
      returns.push(null);
    }
  });

  return returns;
}

export async function getCorrelationMatrix(options: {
  positions: Position[];
  period?: StockComparisonPeriod;
  includeBenchmarks?: boolean;
  baseCurrency?: 'USD' | 'KRW';
  limit?: number;
}): Promise<CorrelationMatrixResponse> {
  const {
    positions,
    period = '3m',
    includeBenchmarks = false,
    baseCurrency = 'KRW',
    limit = 12,
  } = options;

  const comparison = await getStockComparisonData({
    positions,
    period,
    includeBenchmarks,
    baseCurrency,
    limit,
  });

  const series = comparison.series;
  const dateSet = new Set<string>();
  series.forEach((item) => {
    item.data.forEach((point) => {
      if (point.price !== null && Number.isFinite(point.price)) {
        dateSet.add(point.date);
      }
    });
  });

  const dates = Array.from(dateSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const returnsMap = new Map<string, Array<number | null>>();
  series.forEach((item) => {
    const returns = buildReturnSeries(item.data, dates);
    returnsMap.set(item.symbol, returns);
  });

  const symbols: CorrelationSymbol[] = series.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    currency: item.currency,
    isBenchmark: item.isBenchmark,
  }));

  const matrix: (number | null)[][] = symbols.map(() => Array(symbols.length).fill(null));

  for (let i = 0; i < symbols.length; i += 1) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < symbols.length; j += 1) {
      const a = returnsMap.get(symbols[i].symbol) ?? [];
      const b = returnsMap.get(symbols[j].symbol) ?? [];
      const corr = computeCorrelation(a, b);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return {
    success: true,
    period,
    baseCurrency: comparison.baseCurrency ?? baseCurrency,
    symbols,
    matrix,
    generatedAt: new Date().toISOString(),
    meta: {
      dateCount: dates.length,
      includeBenchmarks,
      totalSeries: symbols.length,
    },
  };
}

