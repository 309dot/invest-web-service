"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPercent } from '@/lib/utils/formatters';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { useAuth } from '@/lib/contexts/AuthContext';

interface BenchmarkComparisonProps {
  portfolioId: string;
}

type BenchmarkRow = PortfolioAnalysis['benchmarkComparison'][number] & {
  delta: number | null;
};

export function BenchmarkComparison({ portfolioId }: BenchmarkComparisonProps) {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    if (!user) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/portfolio/analysis?portfolioId=${portfolioId}&userId=${user.uid}`
      );
      if (!response.ok) {
        throw new Error(`분석 데이터를 불러오지 못했습니다. (status: ${response.status})`);
      }
      const payload = await response.json();
      setAnalysis(payload.analysis ?? null);
    } catch (err) {
      console.error('[BenchmarkComparison] 분석 로딩 실패', err);
      setError(err instanceof Error ? err.message : '분석 데이터 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, user]);

  useEffect(() => {
    if (user?.uid) {
      fetchAnalysis();
    }
  }, [user, fetchAnalysis]);

  const rows: BenchmarkRow[] = useMemo(() => {
    if (!analysis) {
      return [];
    }
    const baseReturn = analysis.overallReturnRate;
    return (analysis.benchmarkComparison ?? []).map((entry) => ({
      ...entry,
      delta:
        entry.returnRate === null || !Number.isFinite(baseReturn)
          ? null
          : baseReturn - entry.returnRate,
    }));
  }, [analysis]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">벤치마크 비교</CardTitle>
        <CardDescription>
          KOSPI, S&amp;P 500, 글로벌 60/40 포트폴리오와의 수익률을 비교합니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            비교 가능한 벤치마크 데이터를 찾지 못했습니다. 잠시 후 다시 시도해주세요.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border border-primary/10 bg-background/80 p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-primary">내 포트폴리오</span>
                  <span className="text-xs text-muted-foreground">
                    전체 수익률
                  </span>
                </div>
                <span
                  className={`text-lg font-semibold ${
                    analysis!.overallReturnRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {formatPercent(analysis!.overallReturnRate)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((row) => {
                const trend =
                  row.delta === null
                    ? 'neutral'
                    : row.delta >= 0
                      ? 'outperform'
                      : 'underperform';
                const trendBadge =
                  trend === 'outperform' ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600">초과 수익</Badge>
                  ) : trend === 'underperform' ? (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      미달
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-dashed">
                      비교 불가
                    </Badge>
                  );

                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-md border border-primary/10 bg-background/60 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{row.name}</span>
                        {trendBadge}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        기준: {row.since} ~ 현재 · {row.symbol}
                      </p>
                      {row.note ? (
                        <p className="text-xs text-amber-600">{row.note}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-sm">
                      <span
                        className={`font-semibold ${
                          row.returnRate === null
                            ? 'text-muted-foreground'
                            : row.returnRate >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                        }`}
                      >
                        {row.returnRate === null ? '데이터 없음' : formatPercent(row.returnRate)}
                      </span>
                      <span
                        className={`text-xs ${
                          row.delta === null
                            ? 'text-muted-foreground'
                            : row.delta >= 0
                              ? 'text-emerald-600'
                              : 'text-red-600'
                        }`}
                      >
                        {row.delta === null
                          ? '비교 정보 없음'
                          : row.delta >= 0
                            ? `+${formatPercent(row.delta)} 대비 우위`
                            : `${formatPercent(row.delta)} 대비 열위`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

