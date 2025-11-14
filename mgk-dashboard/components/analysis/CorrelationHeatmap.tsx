"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type { CorrelationMatrixResponse, StockComparisonPeriod } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const PERIOD_OPTIONS: Array<{ id: StockComparisonPeriod; label: string }> = [
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
];

interface CorrelationHeatmapProps {
  portfolioId: string;
}

function toColor(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'var(--background)';
  }
  const bounded = Math.max(-1, Math.min(1, value));
  const hue = bounded > 0 ? 145 : 0;
  const intensity = Math.abs(bounded);
  const saturation = 70;
  const lightness = 100 - intensity * 40;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function formatCorrelation(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  return value.toFixed(2);
}

export function CorrelationHeatmap({ portfolioId }: CorrelationHeatmapProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StockComparisonPeriod>('3m');
  const [includeBenchmarks, setIncludeBenchmarks] = useState(false);
  const [data, setData] = useState<CorrelationMatrixResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCorrelation = useCallback(async () => {
    if (!user) {
      return;
    }
    const params = new URLSearchParams({
      portfolioId,
      userId: user.uid,
      period,
    });
    if (includeBenchmarks) {
      params.set('includeBenchmarks', 'true');
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portfolio/correlation?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`요청 실패 (status: ${response.status}) ${text}`);
      }
      const payload = (await response.json()) as CorrelationMatrixResponse;
      setData(payload);
    } catch (err) {
      console.error('[CorrelationHeatmap] 데이터 로딩 실패', err);
      setError(err instanceof Error ? err.message : '상관관계 데이터를 불러오지 못했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [includeBenchmarks, period, portfolioId, user]);

  useEffect(() => {
    fetchCorrelation();
  }, [fetchCorrelation]);

  const symbols = data?.symbols ?? [];
  const matrix = data?.matrix ?? [];
  const hasMatrix = symbols.length > 0 && matrix.length === symbols.length;
  const generatedAt = data?.generatedAt ?? null;

  const correlationSummary = useMemo(() => {
    if (!hasMatrix) {
      return null;
    }
    const positives: Array<{ pair: string; value: number }> = [];
    const negatives: Array<{ pair: string; value: number }> = [];
    for (let i = 0; i < symbols.length; i += 1) {
      for (let j = i + 1; j < symbols.length; j += 1) {
        const value = matrix[i][j];
        if (value === null || Number.isNaN(value)) {
          continue;
        }
        const pair = `${symbols[i].symbol}/${symbols[j].symbol}`;
        if (value >= 0.5) {
          positives.push({ pair, value });
        } else if (value <= -0.3) {
          negatives.push({ pair, value });
        }
      }
    }
    positives.sort((a, b) => b.value - a.value);
    negatives.sort((a, b) => a.value - b.value);
    return {
      positives: positives.slice(0, 3),
      negatives: negatives.slice(0, 3),
    };
  }, [hasMatrix, matrix, symbols]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">상관관계 히트맵</CardTitle>
            <CardDescription>
              종목 간 동조화 정도를 색상으로 확인하고, 분산 투자 기회를 탐색하세요.
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
            <Button
              size="sm"
              variant={includeBenchmarks ? 'default' : 'outline'}
              onClick={() => setIncludeBenchmarks((prev) => !prev)}
            >
              {includeBenchmarks ? '벤치마크 포함' : '벤치마크 제외'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !hasMatrix ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            상관관계를 계산할 수 있는 데이터가 부족합니다. 기간을 늘리거나 보유 종목을 확인해주세요.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `150px repeat(${symbols.length}, minmax(80px, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-10 bg-primary/10 p-2 text-xs font-semibold uppercase text-muted-foreground">
                  종목
                </div>
                {symbols.map((symbol) => (
                  <div
                    key={`header-${symbol.symbol}`}
                    className="p-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    {symbol.symbol}
                    {symbol.isBenchmark ? (
                      <Badge variant="outline" className="ml-1 text-[10px] uppercase">
                        Bench
                      </Badge>
                    ) : null}
                  </div>
                ))}

                {symbols.map((rowSymbol, rowIndex) => (
                  <div key={`row-${rowSymbol.symbol}`} className="contents">
                    <div className="sticky left-0 z-10 bg-primary/10 p-2 text-xs font-semibold text-muted-foreground">
                      {rowSymbol.symbol}{' '}
                      <span className="text-muted-foreground/70">{rowSymbol.name}</span>
                    </div>
                    {symbols.map((colSymbol, colIndex) => {
                      const value = matrix[rowIndex][colIndex];
                      return (
                        <div
                          key={`cell-${rowSymbol.symbol}-${colSymbol.symbol}`}
                          className="flex h-16 items-center justify-center border border-primary/10 text-xs font-semibold"
                          style={{ backgroundColor: toColor(value) }}
                        >
                          {formatCorrelation(value)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[hsl(145,70%,60%)]" />
                강한 양의 상관관계
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-[hsl(0,70%,60%)]" />
                강한 음의 상관관계
              </span>
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3" />
                상관관계는 과거 데이터 기반이며, 미래 수익을 보장하지 않습니다.
              </span>
              {generatedAt ? (
                <span className="ml-auto">업데이트: {new Date(generatedAt).toLocaleString()}</span>
              ) : null}
            </div>

            {correlationSummary ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    높은 양의 상관관계 (동일한 움직임)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {correlationSummary.positives.length === 0 ? (
                      <li>특별히 높은 양의 상관관계가 감지되지 않았습니다.</li>
                    ) : (
                      correlationSummary.positives.map((item) => (
                        <li key={`pos-${item.pair}`}>
                          {item.pair} : {formatCorrelation(item.value)}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive">
                    음의 상관관계 (분산 효과)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {correlationSummary.negatives.length === 0 ? (
                      <li>뚜렷한 음의 상관관계 조합이 없습니다.</li>
                    ) : (
                      correlationSummary.negatives.map((item) => (
                        <li key={`neg-${item.pair}`}>
                          {item.pair} : {formatCorrelation(item.value)}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

