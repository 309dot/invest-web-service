"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { CalendarClock, Info, TrendingDown, TrendingUp } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import { formatAmount, formatPercent } from '@/lib/utils/formatters';
import type {
  StockComparisonPeriod,
  StockComparisonResponse,
  StockComparisonSeries,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ChartMode = 'return' | 'price';

const PERIOD_OPTIONS: Array<{ id: StockComparisonPeriod; label: string }> = [
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
];

const MODE_OPTIONS: Array<{ id: ChartMode; label: string; description: string }> = [
  { id: 'return', label: '정규화 뷰', description: '기준 시점 대비 수익률(%)' },
  { id: 'price', label: '절대값 뷰', description: '기준 통화의 가격' },
];

const COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#a855f7',
  '#dc2626',
  '#0ea5e9',
  '#facc15',
  '#14b8a6',
  '#f472b6',
  '#fb7185',
];

const BENCHMARK_COLORS = ['#111827', '#6b7280'];

function getColorForIndex(index: number, isBenchmark: boolean): string {
  if (isBenchmark) {
    return BENCHMARK_COLORS[index % BENCHMARK_COLORS.length] ?? '#111827';
  }
  return COLOR_PALETTE[index % COLOR_PALETTE.length] ?? '#2563eb';
}

function formatMaybePercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return formatPercent(value);
}

function formatMaybeNumber(value: number | null | undefined, formatter: (val: number) => string): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return formatter(value);
}

type RechartsTooltipPayload = NonNullable<TooltipProps['payload']>[number];

interface StockComparisonChartProps {
  portfolioId: string;
}

export function StockComparisonChart({ portfolioId }: StockComparisonChartProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StockComparisonPeriod>('3m');
  const [mode, setMode] = useState<ChartMode>('return');
  const [includeBenchmarks, setIncludeBenchmarks] = useState(true);
  const [series, setSeries] = useState<StockComparisonSeries[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<'USD' | 'KRW'>('KRW');
  const [periodLabel, setPeriodLabel] = useState<string>('3개월');
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleSymbols, setVisibleSymbols] = useState<Set<string>>(new Set());

  const seriesBySymbol = useMemo(() => {
    const map = new Map<string, StockComparisonSeries>();
    series.forEach((item) => map.set(item.symbol, item));
    return map;
  }, [series]);

  const colorBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    let benchmarkIndex = 0;
    let regularIndex = 0;
    series.forEach((item) => {
      const color = item.isBenchmark
        ? getColorForIndex(benchmarkIndex++, true)
        : getColorForIndex(regularIndex++, false);
      map.set(item.symbol, color);
    });
    return map;
  }, [series]);

  const updateVisibleSymbols = useCallback(
    (incoming: StockComparisonSeries[]) => {
      setVisibleSymbols((prev) => {
        if (prev.size === 0) {
          return new Set(incoming.map((item) => item.symbol));
        }
        const next = new Set<string>();
        incoming.forEach((item) => {
          if (prev.has(item.symbol)) {
            next.add(item.symbol);
          }
        });
        if (next.size === 0) {
          incoming.forEach((item) => next.add(item.symbol));
        }
        return next;
      });
    },
    []
  );

  const fetchComparison = useCallback(async () => {
    if (!user) {
      return;
    }
    const params = new URLSearchParams({
      portfolioId,
      userId: user.uid,
      period,
    });
    if (!includeBenchmarks) {
      params.set('includeBenchmarks', 'false');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portfolio/comparison?${params.toString()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`요청 실패 (status: ${response.status}) ${text}`);
      }

      const payload = (await response.json()) as StockComparisonResponse;
      setSeries(payload.series ?? []);
      setBaseCurrency(payload.baseCurrency ?? 'KRW');
      setPeriodLabel(String(payload.meta?.periodLabel ?? PERIOD_OPTIONS.find((opt) => opt.id === period)?.label ?? ''));
      setGeneratedAt(payload.generatedAt ?? null);
      updateVisibleSymbols(payload.series ?? []);
    } catch (err) {
      console.error('[StockComparisonChart] 데이터 로딩 실패', err);
      setError(err instanceof Error ? err.message : '종목 비교 데이터를 불러오지 못했습니다.');
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, [includeBenchmarks, period, portfolioId, updateVisibleSymbols, user]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const symbolPointMap = useMemo(() => {
    const map = new Map<string, Record<string, StockComparisonSeries['data'][number]>>();
    series.forEach((item) => {
      const perDate: Record<string, StockComparisonSeries['data'][number]> = {};
      item.data.forEach((point) => {
        perDate[point.date] = point;
      });
      map.set(item.symbol, perDate);
    });
    return map;
  }, [series]);

  const chartData = useMemo(() => {
    if (series.length === 0) {
      return [];
    }
    const dateSet = new Set<string>();
    series.forEach((item) => {
      item.data.forEach((point) => {
        if (point.returnPct !== null || point.price !== null) {
          dateSet.add(point.date);
        }
      });
    });
    const sortedDates = Array.from(dateSet).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    return sortedDates.map((date) => {
      const entry: Record<string, string | number | null> = { date };
      series.forEach((item) => {
        const point = symbolPointMap.get(item.symbol)?.[date];
        entry[`${item.symbol}_return`] = point?.returnPct ?? null;
        entry[`${item.symbol}_price`] = point?.price ?? null;
      });
      return entry;
    });
  }, [series, symbolPointMap]);

  const activeSeries = useMemo(
    () => series.filter((item) => visibleSymbols.has(item.symbol)),
    [series, visibleSymbols]
  );

  const seriesPresent = series.length > 0 && chartData.length > 0;

  const formatBaseAmount = useCallback(
    (value: number, options?: { withSign?: boolean }) => {
      const formatted = formatAmount(Math.abs(value), baseCurrency);
      if (options?.withSign) {
        if (Math.abs(value) < 1e-8) {
          return formatted;
        }
        return value >= 0 ? `+${formatted}` : `-${formatted}`;
      }
      return formatted;
    },
    [baseCurrency]
  );

  const handleToggleSymbol = useCallback(
    (symbol: string) => {
      setVisibleSymbols((prev) => {
        const next = new Set(prev);
        if (next.has(symbol)) {
          if (next.size === 1) {
            return prev;
          }
          next.delete(symbol);
        } else {
          next.add(symbol);
        }
        return next;
      });
    },
    []
  );

  const yAxisTickFormatter = useCallback(
    (value: number) => {
      if (!Number.isFinite(value)) {
        return '';
      }
      return mode === 'return' ? formatPercent(value) : formatAmount(value, baseCurrency);
    },
    [baseCurrency, mode]
  );

  const CustomTooltip = useCallback(
    ({ label, payload }: TooltipProps<number, string>) => {
      if (!payload || payload.length === 0) {
        return null;
      }
      const rows: Array<{
        symbol: string;
        name: string;
        color: string;
        value: string;
        returnPct?: string;
        isBenchmark: boolean;
      }> = [];

      payload.forEach((item) => {
        const dataKey = (item.dataKey as string) ?? '';
        const symbol = dataKey.split('_')[0];
        const serie = seriesBySymbol.get(symbol);
        if (!serie || !visibleSymbols.has(symbol)) {
          return;
        }
        const color = colorBySymbol.get(symbol) ?? item.color ?? '#2563eb';
        const point = symbolPointMap.get(symbol)?.[label ?? ''];
        const displayValue =
          mode === 'return'
            ? formatMaybePercent(point?.returnPct ?? null)
            : formatMaybeNumber(point?.price ?? null, (val) => formatAmount(val, baseCurrency));
        const returnText =
          mode === 'return'
            ? undefined
            : formatMaybePercent(point?.returnPct ?? serie.latestReturnPct ?? null);

        rows.push({
          symbol,
          name: serie.name,
          color,
          value: displayValue,
          returnPct: returnText,
          isBenchmark: serie.isBenchmark,
        });
      });

      if (!rows.length) {
        return null;
      }

      return (
        <div className="rounded-md border bg-background/95 p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="mt-2 space-y-1">
            {rows.map((row) => (
              <div key={row.symbol} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="font-medium">{row.name}</span>
                  {row.isBenchmark ? <Badge variant="outline">벤치마크</Badge> : null}
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-foreground">{row.value}</span>
                  {row.returnPct ? (
                    <span className="text-[10px] text-muted-foreground">누적 {row.returnPct}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    },
    [baseCurrency, colorBySymbol, mode, seriesBySymbol, symbolPointMap, visibleSymbols]
  );

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">종목별 성과 비교</CardTitle>
            <CardDescription>
              {periodLabel} 동안의 정상화 수익률과 벤치마크 대비 흐름을 확인하세요.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={period === option.id ? 'default' : 'outline'}
                onClick={() => setPeriod(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {MODE_OPTIONS.map((option) => (
            <Button
              key={option.id}
              variant={mode === option.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode(option.id)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            variant={includeBenchmarks ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIncludeBenchmarks((prev) => !prev)}
          >
            {includeBenchmarks ? '벤치마크 포함' : '벤치마크 제외'}
          </Button>
          <Badge variant="secondary" className="ml-auto text-xs">
            기준 통화: {baseCurrency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        ) : seriesPresent ? (
          <>
            <div className="space-y-3 rounded-md border border-primary/10 bg-background/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {series.map((item) => (
                  <Button
                    key={item.symbol}
                    variant={visibleSymbols.has(item.symbol) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleToggleSymbol(item.symbol)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorBySymbol.get(item.symbol) ?? '#2563eb' }}
                    />
                    <span>{item.name}</span>
                    {item.isBenchmark ? <Badge variant="outline">벤치마크</Badge> : null}
                  </Button>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                {MODE_OPTIONS.find((option) => option.id === mode)?.description ?? ''}
              </p>
            </div>

            <div className="relative h-[340px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.3)" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={yAxisTickFormatter}
                    tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                    width={80}
                  />
                  <Tooltip content={CustomTooltip} />
                  {activeSeries.map((item, index) => (
                    <Line
                      key={item.symbol}
                      type="monotone"
                      dataKey={`${item.symbol}_${mode}`}
                      stroke={colorBySymbol.get(item.symbol) ?? getColorForIndex(index, item.isBenchmark)}
                      strokeWidth={item.isBenchmark ? 2.5 : 2}
                      dot={false}
                      name={item.name}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  마지막 업데이트:{' '}
                  {generatedAt ? new Date(generatedAt).toLocaleString() : '정보 없음'}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-primary/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>종목</TableHead>
                    <TableHead className="text-right">누적 수익률</TableHead>
                    <TableHead className="text-right">연환산 수익률</TableHead>
                    <TableHead className="text-right">변동성</TableHead>
                    <TableHead className="text-right">샤프 지수</TableHead>
                    <TableHead className="text-right">최대 낙폭</TableHead>
                    <TableHead className="text-right">최근 가격</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.map((item) => (
                    <TableRow key={`row-${item.symbol}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: colorBySymbol.get(item.symbol) ?? '#2563eb' }}
                          />
                          {item.name}
                          {item.isBenchmark ? <Badge variant="outline">벤치마크</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            item.metrics.totalReturnPct !== null && item.metrics.totalReturnPct < 0
                              ? 'text-destructive'
                              : 'text-emerald-600'
                          }
                        >
                          {formatMaybePercent(item.metrics.totalReturnPct)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMaybePercent(item.metrics.annualizedReturnPct)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMaybePercent(item.metrics.volatilityPct)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.metrics.sharpe === null || Number.isNaN(item.metrics.sharpe)
                          ? '—'
                          : item.metrics.sharpe.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.metrics.maxDrawdownPct === null
                          ? '—'
                          : formatPercent(item.metrics.maxDrawdownPct)}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.latestPrice === null
                          ? '—'
                          : formatAmount(item.latestPrice, baseCurrency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {series.map((item) => (
                <div
                  key={`insight-${item.symbol}`}
                  className="rounded-md border border-muted bg-background/80 p-3 text-xs leading-relaxed text-muted-foreground"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorBySymbol.get(item.symbol) ?? '#2563eb' }}
                    />
                    {item.name}
                    {item.isBenchmark ? <Badge variant="outline">벤치마크</Badge> : null}
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                      최고 일간 수익: {formatMaybePercent(item.metrics.bestDayPct)}
                    </p>
                    <p className="flex items-center gap-2">
                      <TrendingDown className="h-3 w-3 text-destructive" />
                      최저 일간 손실: {formatMaybePercent(item.metrics.worstDayPct)}
                    </p>
                    <p>거래 일수: {item.metrics.tradingDays}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            비교 가능한 데이터가 충분하지 않습니다. 기간을 늘리거나 보유 종목을 확인해주세요.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

