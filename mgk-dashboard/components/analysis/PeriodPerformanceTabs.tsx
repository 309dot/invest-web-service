"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { formatPercent } from '@/lib/utils/formatters';
import type { PortfolioPerformancePeriod } from '@/types';
import { isValid, parseISO } from 'date-fns';

interface PeriodPerformanceTabsProps {
  portfolioId: string;
}

type FetchState = 'idle' | 'loading' | 'error' | 'success';

const PERIOD_ORDER: PortfolioPerformancePeriod['id'][] = [
  '1D',
  '1W',
  '1M',
  '3M',
  'YTD',
  '1Y',
  'ALL',
];

export function PeriodPerformanceTabs({ portfolioId }: PeriodPerformanceTabsProps) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const [periods, setPeriods] = useState<PortfolioPerformancePeriod[]>([]);
  const [status, setStatus] = useState<FetchState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!user) {
      return;
    }
    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/portfolio/analysis?portfolioId=${portfolioId}&userId=${user.uid}`
      );

      if (!response.ok) {
        throw new Error(`분석 데이터를 불러오지 못했습니다. (status: ${response.status})`);
      }

      const payload = await response.json();
      const fetched = Array.isArray(payload.performance)
        ? (payload.performance as PortfolioPerformancePeriod[])
        : [];

      setPeriods(sortPeriods(fetched));
      setStatus('success');
    } catch (error) {
      console.error('[PeriodPerformanceTabs] 데이터 로딩 실패', error);
      setErrorMessage(
        error instanceof Error ? error.message : '기간별 성과 데이터를 가져오지 못했습니다.'
      );
      setStatus('error');
    }
  }, [portfolioId, user]);

  useEffect(() => {
    if (user?.uid) {
      fetchPerformance();
    }
  }, [user, fetchPerformance]);

  const defaultPeriodId = useMemo(() => {
    if (!periods.length) {
      return 'ALL';
    }
    const preferred = periods.find((period) => period.totalReturn !== null);
    return preferred?.id ?? periods[0].id;
  }, [periods]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-2 pb-4">
        <CardTitle className="text-base">기간별 성과</CardTitle>
        <CardDescription>
          단기부터 장기까지 누적 수익률과 연환산 수익률을 비교해 추세를 파악하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'loading' ? (
          <PerformanceSkeleton />
        ) : status === 'error' ? (
          <ErrorState message={errorMessage} />
        ) : periods.length === 0 ? (
          <EmptyState />
        ) : (
          <Tabs defaultValue={defaultPeriodId} className="space-y-4">
            <TabsList className="grid grid-cols-2 gap-2 md:grid-cols-7">
              {PERIOD_ORDER.filter((id) => periods.some((period) => period.id === id)).map((id) => {
                const period = periods.find((item) => item.id === id);
                if (!period) {
                  return null;
                }
                return (
                  <TabsTrigger key={period.id} value={period.id}>
                    {period.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {periods.map((period) => (
              <TabsContent key={period.id} value={period.id} className="space-y-4">
                <PeriodSummary period={period} />
                <MetricGrid period={period} formatAmount={formatAmount} />
                {period.note ? (
                  <p className="text-xs text-muted-foreground">{period.note}</p>
                ) : null}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function sortPeriods(periods: PortfolioPerformancePeriod[]): PortfolioPerformancePeriod[] {
  return [...periods].sort((a, b) => PERIOD_ORDER.indexOf(a.id) - PERIOD_ORDER.indexOf(b.id));
}

function PerformanceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {message ?? '기간별 성과 데이터를 불러오는 중 오류가 발생했습니다.'}
    </div>
  );
}

function EmptyState() {
  return (
    <p className="text-sm text-muted-foreground">
      아직 기간별 성과를 계산할 수 있는 데이터가 부족합니다. 자동 투자 내역이 누적되면 그래프가
      활성화됩니다.
    </p>
  );
}

function PeriodSummary({ period }: { period: PortfolioPerformancePeriod }) {
  const totalReturn =
    period.totalReturn === null ? '데이터 없음' : formatPercent(period.totalReturn);
  const trendClass =
    period.totalReturn === null
      ? 'text-muted-foreground'
      : period.totalReturn >= 0
        ? 'text-emerald-600'
        : 'text-red-600';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/10 bg-background/80 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-primary">{period.label} 기준 수익률</p>
        <p className="text-xs text-muted-foreground">
          {formatDateRange(period.startDate, period.endDate)} · 총 {formatNumber(period.periodDays)}일 ·
          샘플 {formatNumber(period.sampleCount)}건
        </p>
      </div>
      <div className="flex items-center gap-3">
        {period.annualizedReturn !== null ? (
          <Badge variant="outline" className="border-primary/40 text-primary">
            연환산 {formatPercent(period.annualizedReturn)}
          </Badge>
        ) : null}
        <span className={`text-lg font-semibold ${trendClass}`}>{totalReturn}</span>
      </div>
    </div>
  );
}

function MetricGrid({
  period,
  formatAmount,
}: {
  period: PortfolioPerformancePeriod;
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
}) {
  const metrics = [
    {
      label: '평가 금액',
      value: formatMoney(period.endValue, formatAmount),
      helper: `현재 평가액 (${formatDate(period.endDate)})`,
    },
    {
      label: '총 투자금',
      value: formatMoney(period.endInvested, formatAmount),
      helper: `누적 투자 원금 (${formatDate(period.endDate)})`,
    },
    {
      label: '절대 수익',
      value: formatMoney(period.absoluteReturn, formatAmount, true),
      helper: '현재 평가액 - 기간 시작 평가액',
    },
    {
      label: '투자금 변화',
      value: formatMoney(period.investedChange, formatAmount, true),
      helper: '기간 내 추가/회수된 투자금 추정치',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-md border border-primary/10 bg-background/60 p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
          <p className="mt-2 text-base font-semibold">{metric.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{metric.helper}</p>
        </div>
      ))}
    </div>
  );
}

function formatMoney(
  value: number | null,
  formatter: (amount: number, sourceCurrency: 'USD' | 'KRW') => string,
  showSign = false
): string {
  if (value === null) {
    return '데이터 없음';
  }

  const formatted = formatter(Math.abs(value), 'USD');
  if (!showSign) {
    return formatted;
  }

  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

function formatDateRange(start: string, end: string): string {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} ~ ${endLabel}`;
}

function formatDate(input: string): string {
  const parsed = parseISO(input);
  if (!isValid(parsed)) {
    return input;
  }
  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

