"use client";

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BenchmarkComparisonEntry } from '@/lib/services/portfolio-analysis';
import { formatPercent, formatRelativeTime, getProfitTextClass, PROFIT_TEXT_NEGATIVE, PROFIT_TEXT_POSITIVE, PROFIT_TEXT_NEUTRAL } from '@/lib/utils/formatters';

interface BenchmarkComparisonProps {
  portfolioReturnRate: number | null | undefined;
  benchmarks?: BenchmarkComparisonEntry[] | null;
  loading?: boolean;
  lastUpdated?: string | null;
}

type BenchmarkStatus = 'outperform' | 'underperform' | 'mixed' | 'no-data';

interface BenchmarkRow extends BenchmarkComparisonEntry {
  delta: number | null;
}

export function BenchmarkComparison({
  portfolioReturnRate,
  benchmarks,
  loading = false,
  lastUpdated,
}: BenchmarkComparisonProps) {
  const rows: BenchmarkRow[] = useMemo(() => {
    if (!benchmarks || benchmarks.length === 0) {
      return [];
    }

    return benchmarks.map((benchmark) => ({
      ...benchmark,
      delta:
        portfolioReturnRate === null ||
        portfolioReturnRate === undefined ||
        benchmark.returnRate === null
          ? null
          : portfolioReturnRate - benchmark.returnRate,
    }));
  }, [benchmarks, portfolioReturnRate]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        variant: 'no-data' as BenchmarkStatus,
        title: '벤치마크 데이터를 불러오는 중입니다',
        description: '데이터 제공원 응답에 따라 몇 초 정도 소요될 수 있습니다.',
      };
    }

    const resolved = rows.filter((row) => row.returnRate !== null && row.delta !== null);
    if (resolved.length === 0) {
      return {
        variant: 'no-data' as BenchmarkStatus,
        title: '비교 가능한 벤치마크가 없습니다',
        description: '데이터 소스에서 유효한 수익률을 반환하지 않아 비교를 진행할 수 없습니다.',
      };
    }

    const outperform = resolved.filter((row) => (row.delta ?? 0) > 0).length;
    const underperform = resolved.filter((row) => (row.delta ?? 0) < 0).length;

    if (outperform === resolved.length) {
      return {
        variant: 'outperform' as BenchmarkStatus,
        title: '주요 벤치마크를 모두 상회하고 있어요',
        description: '현재 포트폴리오 전략이 시장 대비 우수합니다. 현 전략을 유지하며 리스크만 관리해 보세요.',
      };
    }

    if (underperform === resolved.length) {
      return {
        variant: 'underperform' as BenchmarkStatus,
        title: '대부분의 벤치마크 대비 수익률이 낮습니다',
        description: '시장 지수보다 수익률이 낮아 리밸런싱이 필요할 수 있습니다. 하락 원인을 점검해 보세요.',
      };
    }

    return {
      variant: 'mixed' as BenchmarkStatus,
      title: '벤치마크별로 성과가 엇갈리고 있습니다',
      description: '상승세를 보이는 지수와 하회 중인 지수를 구분해 리스크/수익 균형을 조정해 보세요.',
    };
  }, [rows]);

  const summaryBadge = useMemo(() => {
    switch (summary.variant) {
      case 'outperform':
        return (
          <Badge className="bg-emerald-600 text-xs font-medium hover:bg-emerald-600">
            초과 수익
          </Badge>
        );
      case 'underperform':
        return (
          <Badge variant="outline" className="border-red-500 text-xs font-medium text-red-600">
            시장 미달
          </Badge>
        );
      case 'mixed':
        return (
          <Badge variant="outline" className="border-dashed text-xs font-medium">
            혼합 성과
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-dashed text-xs font-medium">
            데이터 대기
          </Badge>
        );
    }
  }, [summary.variant]);

  const portfolioReturnClass = getProfitTextClass(portfolioReturnRate ?? 0, {
    zeroAsNeutral: true,
    emphasize: true,
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">벤치마크 비교</CardTitle>
            <CardDescription>주요 시장 지수와 대비해 현재 수익률 위치를 확인하세요.</CardDescription>
          </div>
          {summaryBadge}
        </div>
        {lastUpdated ? (
          <p className="text-xs text-muted-foreground">
            최근 업데이트: {formatRelativeTime(lastUpdated)}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 border-t border-muted/40 pt-4">
        <div className="flex flex-col gap-2 rounded-md border border-primary/10 bg-primary/5 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">내 포트폴리오 (누적 수익률)</p>
            <p className={`text-xl ${portfolioReturnClass}`}>
              {portfolioReturnRate === null || portfolioReturnRate === undefined
                ? '데이터 없음'
                : formatPercent(portfolioReturnRate)}
            </p>
          </div>
          {summary.description ? (
            <p className="text-xs text-muted-foreground md:text-right">{summary.description}</p>
          ) : null}
        </div>

        {loading && !rows.length ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>벤치마크 데이터를 불러오는 중입니다...</p>
            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-10/12 animate-pulse rounded bg-muted/50" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-4 text-sm text-muted-foreground">
            비교 가능한 벤치마크가 아직 연결되지 않았습니다. 곧 데이터를 수집해 보여드릴게요.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const benchClass =
                row.returnRate === null
                  ? PROFIT_TEXT_NEUTRAL
                  : row.returnRate >= 0
                    ? PROFIT_TEXT_POSITIVE
                    : PROFIT_TEXT_NEGATIVE;
              const deltaClass =
                row.delta === null
                  ? PROFIT_TEXT_NEUTRAL
                  : row.delta >= 0
                    ? PROFIT_TEXT_POSITIVE
                    : PROFIT_TEXT_NEGATIVE;

              const deltaIcon =
                row.delta === null ? (
                  <Minus className={`h-3 w-3 ${PROFIT_TEXT_NEUTRAL}`} />
                ) : row.delta >= 0 ? (
                  <ArrowUpRight className={`h-3 w-3 ${PROFIT_TEXT_POSITIVE}`} />
                ) : (
                  <ArrowDownRight className={`h-3 w-3 ${PROFIT_TEXT_NEGATIVE}`} />
                );

              const deltaLabel =
                row.delta === null
                  ? '비교 정보 없음'
                  : row.delta >= 0
                    ? `+${formatPercent(row.delta)} 초과`
                    : `${formatPercent(row.delta)} 미달`;

              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-md border border-muted/40 bg-background/60 p-4 transition hover:border-primary/40 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span>{row.name}</span>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {row.symbol}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      기준: {row.since} ~ 현재 · {row.currency}
                    </p>
                    {row.note ? (
                      <p className="text-xs text-amber-600">{row.note}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4 text-sm md:text-base">
                    <div className="text-right">
                      <p className={`font-semibold ${benchClass}`}>
                        {row.returnRate === null ? '데이터 없음' : formatPercent(row.returnRate)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {row.source === 'yahoo'
                          ? 'Yahoo Finance'
                          : row.source === 'cache'
                            ? 'Cache 데이터'
                            : row.source === 'fallback'
                              ? '보조 추정치'
                              : '수동 입력'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs md:text-sm">
                      {deltaIcon}
                      <span className={`font-medium ${deltaClass}`}>{deltaLabel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


