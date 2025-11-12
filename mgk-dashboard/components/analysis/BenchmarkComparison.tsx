"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  BenchmarkPeriodPerformance,
  PerformancePeriodKey,
  PortfolioAnalysis,
} from '@/types';

const COMPARISON_PERIODS: PerformancePeriodKey[] = ['1M', 'YTD', '1Y', 'ALL'];

const PERIOD_LABELS: Record<PerformancePeriodKey, string> = {
  '1D': '1일',
  '1W': '1주',
  '1M': '1개월',
  '3M': '3개월',
  YTD: '연초 이후',
  '1Y': '1년',
  ALL: '전체',
};

function formatReturn(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'N/A';
  }
  const formatted = Math.abs(value).toFixed(2);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatted}%`;
}

interface BenchmarkComparisonProps {
  portfolioPerformance: PortfolioAnalysis['performanceSummary'];
  benchmarks: BenchmarkPeriodPerformance[];
}

export function BenchmarkComparison({
  portfolioPerformance,
  benchmarks,
}: BenchmarkComparisonProps) {
  if (!portfolioPerformance || !benchmarks) {
    return null;
  }

  const portfolioReturns: Record<PerformancePeriodKey, number | null> = {} as Record<
    PerformancePeriodKey,
    number | null
  >;
  COMPARISON_PERIODS.forEach((period) => {
    portfolioReturns[period] = portfolioPerformance.periods[period]?.returnRate ?? null;
  });

  const benchmarkMap = new Map<
    string,
    {
      id: string;
      name: string;
      currency: string;
      returns: Record<PerformancePeriodKey, number | null>;
    }
  >();

  benchmarks.forEach((entry) => {
    if (!benchmarkMap.has(entry.benchmarkId)) {
      benchmarkMap.set(entry.benchmarkId, {
        id: entry.benchmarkId,
        name: entry.benchmarkName,
        currency: entry.currency,
        returns: {
          '1D': null,
          '1W': null,
          '1M': null,
          '3M': null,
          YTD: null,
          '1Y': null,
          ALL: null,
        },
      });
    }
    const record = benchmarkMap.get(entry.benchmarkId);
    if (record) {
      record.returns[entry.period] = entry.returnRate;
    }
  });

  const benchmarkRows = Array.from(benchmarkMap.values());

  return (
    <Card>
      <CardHeader>
        <CardTitle>벤치마크 비교</CardTitle>
        <CardDescription>
          주요 지수 대비 포트폴리오 수익률을 비교합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">항목</TableHead>
              {COMPARISON_PERIODS.map((period) => (
                <TableHead key={period} className="text-right">
                  {PERIOD_LABELS[period]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-semibold">포트폴리오</TableCell>
              {COMPARISON_PERIODS.map((period) => {
                const value = portfolioReturns[period] ?? null;
                const className =
                  value !== null && value < 0
                    ? 'text-red-600 dark:text-red-400 text-right'
                    : 'text-right';
                return (
                  <TableCell key={period} className={className}>
                    {formatReturn(value)}
                  </TableCell>
                );
              })}
            </TableRow>

            {benchmarkRows.map((benchmark) => (
              <TableRow key={benchmark.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{benchmark.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {benchmark.currency}
                    </span>
                  </div>
                </TableCell>
                {COMPARISON_PERIODS.map((period) => {
                  const value = benchmark.returns[period] ?? null;
                  const className =
                    value !== null && value < 0
                      ? 'text-red-600 dark:text-red-400 text-right'
                      : 'text-right';
                  return (
                    <TableCell key={`${benchmark.id}-${period}`} className={className}>
                      {formatReturn(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          * 벤치마크 수익률은 각 지수의 종가 기준으로 계산되며 환율 영향은 반영되지 않습니다.
        </p>
      </CardContent>
    </Card>
  );
}

