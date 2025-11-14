"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type { BacktestResponse, BacktestStrategy } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatPercent } from '@/lib/utils/formatters';

const STRATEGY_LABELS: Record<BacktestStrategy, string> = {
  baseline: '현재 전략',
  equal: '균등 비중',
  growth: '성장형',
  defensive: '방어형',
  diversified: '다각화',
};

const PERIOD_OPTIONS = [
  { value: '90', label: '3개월' },
  { value: '180', label: '6개월' },
  { value: '365', label: '1년' },
  { value: '730', label: '2년' },
];

function formatMetric(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function BacktestCard({ portfolioId }: { portfolioId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<BacktestStrategy>('diversified');
  const [period, setPeriod] = useState<number>(365);

  const fetchBacktest = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        userId: user.uid,
        portfolioId,
        strategy,
        periodDays: period.toString(),
      });
      const response = await fetch(`/api/portfolio/backtest?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || `백테스트 요청 실패 (status: ${response.status})`;
        throw new Error(message);
      }
      const payload = (await response.json()) as BacktestResponse;
      setData(payload);
    } catch (err) {
      console.error('[BacktestCard] 로딩 실패', err);
      setError(err instanceof Error ? err.message : '백테스트 데이터를 불러오지 못했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, user, strategy, period]);

  useEffect(() => {
    fetchBacktest();
  }, [fetchBacktest]);

  const chartPoints = useMemo(() => {
    if (!data?.series?.length) {
      return [];
    }
    const step = Math.ceil(data.series.length / 8);
    return data.series.filter((_, index) => index % step === 0 || index === data.series.length - 1);
  }, [data]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-primary" />
              백테스트 분석
            </CardTitle>
            <CardDescription>
              선택한 기간 동안 현재 전략과 대안 전략의 성과를 비교합니다.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period.toString()} onValueChange={(value) => setPeriod(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="기간" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={strategy} onValueChange={(value) => setStrategy(value as BacktestStrategy)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="전략" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STRATEGY_LABELS) as BacktestStrategy[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {STRATEGY_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={fetchBacktest} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              새로고침
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

        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <>
            <section className="rounded-lg border border-primary/10 bg-background/60 p-4">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>
                  기간: {data.period.startDate} ~ {data.period.endDate} ({data.period.days}일)
                </span>
                <Badge variant="outline" className="border-primary/30 text-xs">
                  전략: {STRATEGY_LABELS[data.strategy]}
                </Badge>
                <span className="text-muted-foreground/70">
                  생성 시각: {new Date(data.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-primary/10 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">누적 수익률</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-primary">
                      {formatMetric(data.baseline.totalReturn)}
                    </span>
                    <span className="text-xs text-muted-foreground">현재 전략</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm">
                    <span className="text-emerald-600 font-semibold">
                      {formatMetric(data.scenario.totalReturn)}
                    </span>
                    <span className="text-xs text-muted-foreground">{STRATEGY_LABELS[data.strategy]}</span>
                  </div>
                </div>
                <div className="rounded-md border border-primary/10 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">연환산 수익률</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-primary">
                      {formatMetric(data.baseline.annualizedReturn)}
                    </span>
                    <span className="text-xs text-muted-foreground">현재 전략</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm">
                    <span className="text-emerald-600 font-semibold">
                      {formatMetric(data.scenario.annualizedReturn)}
                    </span>
                    <span className="text-xs text-muted-foreground">{STRATEGY_LABELS[data.strategy]}</span>
                  </div>
                </div>
                <div className="rounded-md border border-primary/10 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">변동성</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-primary">
                      {formatPercent(data.baseline.volatility)}
                    </span>
                    <span className="text-xs text-muted-foreground">현재 전략</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm">
                    <span
                      className={`font-semibold ${
                        data.scenario.volatility <= data.baseline.volatility ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(data.scenario.volatility)}
                    </span>
                    <span className="text-xs text-muted-foreground">{STRATEGY_LABELS[data.strategy]}</span>
                  </div>
                </div>
                <div className="rounded-md border border-primary/10 bg-background/80 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">최대 낙폭</p>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-primary">
                      {formatPercent(data.baseline.maxDrawdown)}
                    </span>
                    <span className="text-xs text-muted-foreground">현재 전략</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm">
                    <span
                      className={`font-semibold ${
                        data.scenario.maxDrawdown >= data.baseline.maxDrawdown ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {formatPercent(data.scenario.maxDrawdown)}
                    </span>
                    <span className="text-xs text-muted-foreground">{STRATEGY_LABELS[data.strategy]}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-primary">성과 추이</h3>
              {chartPoints.length === 0 ? (
                <Alert>
                  <AlertDescription>그래프를 표시할 데이터가 부족합니다.</AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-lg border border-primary/10 bg-background/70">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>날짜</TableHead>
                        <TableHead className="text-right">현재 전략</TableHead>
                        <TableHead className="text-right">{STRATEGY_LABELS[data.strategy]}</TableHead>
                        <TableHead className="text-right">차이</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartPoints.map((point) => (
                        <TableRow key={point.date}>
                          <TableCell>{point.date}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {(point.baseline * 100).toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {(point.scenario * 100).toFixed(2)}%
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              point.scenario >= point.baseline ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {((point.scenario - point.baseline) * 100).toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

