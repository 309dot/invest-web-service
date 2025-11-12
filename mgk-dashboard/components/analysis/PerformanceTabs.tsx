"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PerformancePeriodKey, PerformancePeriod } from '@/types';

const PERIOD_LABELS: Record<PerformancePeriodKey, string> = {
  '1D': '1일',
  '1W': '1주',
  '1M': '1개월',
  '3M': '3개월',
  YTD: '연초 이후',
  '1Y': '1년',
  ALL: '전체',
};

const PERIOD_DESCRIPTIONS: Partial<Record<PerformancePeriodKey, string>> = {
  '1D': '전일 대비',
  '1W': '7일 기준',
  '1M': '최근 1개월',
  '3M': '최근 3개월',
  YTD: '연초 이후 누적',
  '1Y': '최근 1년',
  ALL: '보유 이후 전체',
};

const PERIOD_ORDER: PerformancePeriodKey[] = ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL'];

function formatReturn(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '데이터 없음';
  }
  const formatted = Math.abs(value).toFixed(2);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatted}%`;
}

interface PerformanceTabsProps {
  performance: {
    latestValuationDate: string | null;
    currentValue: number;
    periods: Record<PerformancePeriodKey, PerformancePeriod>;
  };
  formatValue: (value: number) => string;
}

export function PerformanceTabs({ performance, formatValue }: PerformanceTabsProps) {
  if (!performance || !performance.periods) {
    return null;
  }

  const defaultPeriod = PERIOD_ORDER.find((period) => performance.periods[period]) ?? '1M';

  return (
    <Card>
      <CardHeader>
        <CardTitle>기간별 성과</CardTitle>
        <CardDescription>
          최근 평가일: {performance.latestValuationDate ?? '알 수 없음'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultPeriod}>
          <TabsList className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {PERIOD_ORDER.map((period) => (
              <TabsTrigger key={period} value={period}>
                {PERIOD_LABELS[period]}
              </TabsTrigger>
            ))}
          </TabsList>
          {PERIOD_ORDER.map((period) => {
            const data = performance.periods[period];
            if (!data) {
              return (
                <TabsContent key={period} value={period}>
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    데이터가 없습니다.
                  </p>
                </TabsContent>
              );
            }

            const returnText = formatReturn(data.returnRate);
            const changeSign =
              data.returnRate !== null && data.returnRate > 0
                ? 'text-green-600 dark:text-green-400'
                : data.returnRate !== null && data.returnRate < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground';

            return (
              <TabsContent key={period} value={period} className="mt-4">
                <div className="mb-4">
                  <h4 className="text-lg font-semibold">{PERIOD_LABELS[period]}</h4>
                  <p className="text-sm text-muted-foreground">
                    {PERIOD_DESCRIPTIONS[period] ?? ''}
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      수익률
                    </p>
                    <p className={`mt-2 text-2xl font-semibold ${changeSign}`}>{returnText}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      시작 평가액
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatValue(data.startValue)}
                    </p>
                    {data.effectiveStartDate && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        기준일: {data.effectiveStartDate}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      현재 평가액
                    </p>
                    <p className="mt-2 text-xl font-semibold">
                      {formatValue(data.endValue)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      변화량: {formatValue(data.absoluteChange)}
                    </p>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

