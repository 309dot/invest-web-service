"use client";

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type {
  TransactionTimelineEntry,
  TransactionTimelineGranularity,
  TransactionTimelineResponse,
} from '@/types';

type TransactionTimelineProps = {
  userId: string | null;
  portfolioId: string | null;
  purchaseMethod: 'all' | 'auto' | 'manual';
  selectedSymbol?: string;
  selectedType?: 'buy' | 'sell';
  startDate?: string;
  endDate?: string;
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
};

export function TransactionTimeline({
  userId,
  portfolioId,
  purchaseMethod,
  selectedSymbol,
  selectedType,
  startDate,
  endDate,
  formatAmount,
}: TransactionTimelineProps) {
  const [granularity, setGranularity] = useState<TransactionTimelineGranularity>('week');
  const [data, setData] = useState<TransactionTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePurchaseMethod = purchaseMethod === 'all' ? undefined : purchaseMethod;

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (!userId || !portfolioId) {
      return params;
    }
    params.set('userId', userId);
    params.set('portfolioId', portfolioId);
    params.set('granularity', granularity);
    if (effectivePurchaseMethod) {
      params.set('purchaseMethod', effectivePurchaseMethod);
    }
    if (selectedSymbol) {
      params.set('symbol', selectedSymbol);
    }
    if (selectedType) {
      params.set('type', selectedType);
    }
    if (startDate) {
      params.set('startDate', startDate);
    }
    if (endDate) {
      params.set('endDate', endDate);
    }
    return params;
  }, [userId, portfolioId, granularity, effectivePurchaseMethod, selectedSymbol, selectedType, startDate, endDate]);

  useEffect(() => {
    if (!userId || !portfolioId) {
      return;
    }

    let abort = false;
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(null);

        const response = await fetch(`/api/transactions/timeline?${queryParams.toString()}`);
        if (!response.ok) {
          throw new Error('타임라인 데이터를 불러오는데 실패했습니다.');
        }
        const json = await response.json();
        if (!abort) {
          if (json?.success) {
            setData(json.data as TransactionTimelineResponse);
          } else {
            throw new Error(json?.error || '타임라인 데이터를 불러오는데 실패했습니다.');
          }
        }
      } catch (err) {
        if (!abort) {
          setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        }
      } finally {
        if (!abort) {
          setLoading(false);
        }
      }
    };

    fetchTimeline();

    return () => {
      abort = true;
    };
  }, [userId, portfolioId, queryParams]);

  const handleRefresh = () => {
    if (!userId || !portfolioId) return;
    setData(null);
    setLoading(true);
    setError(null);
    fetch(`/api/transactions/timeline?${queryParams.toString()}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('타임라인 데이터를 새로고침하는 데 실패했습니다.');
        }
        const json = await response.json();
        if (json?.success) {
          setData(json.data as TransactionTimelineResponse);
        } else {
          throw new Error(json?.error || '타임라인 데이터를 새로고침하는 데 실패했습니다.');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const renderAmounts = (entry: TransactionTimelineEntry, currency: 'USD' | 'KRW') => {
    const totals = entry.totalsByCurrency[currency];
    if (totals.buyAmount === 0 && totals.sellAmount === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{currency}</span>
        <span>매수 {formatAmount(totals.buyAmount, currency)}</span>
        <span>· 매도 {formatAmount(totals.sellAmount, currency)}</span>
        <span
          className={cn(
            'font-semibold',
            totals.netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          )}
        >
          순 {formatAmount(Math.abs(totals.netAmount), currency)} {totals.netAmount >= 0 ? '유입' : '유출'}
        </span>
      </div>
    );
  };

  const renderTopSymbols = (entry: TransactionTimelineEntry) => {
    if (!entry.topSymbols.length) {
      return (
        <p className="text-xs text-muted-foreground">주요 거래 종목 데이터가 충분하지 않습니다.</p>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {entry.topSymbols.map((item) => {
          const net = item.sellAmountBase - item.buyAmountBase;
          const tone = net >= 0 ? 'text-emerald-600' : 'text-red-500';
          return (
            <Badge key={item.symbol} variant="outline" className="space-x-2 border-border/70 text-xs">
              <span className="font-semibold">{item.symbol}</span>
              <span className="text-muted-foreground">({item.count}건)</span>
              <span className={cn('font-medium', tone)}>
                {net >= 0 ? '+' : '-'}
                {formatAmount(Math.abs(net), 'USD')}
              </span>
            </Badge>
          );
        })}
      </div>
    );
  };

  if (!userId || !portfolioId) {
    return null;
  }

  return (
    <Card variant="elevated" className="overflow-hidden">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            거래 타임라인 요약
          </CardTitle>
          <CardDescription>주간·월간 단위로 거래 추세와 순현금 흐름을 확인하세요.</CardDescription>
        </div>
        <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
          <Tabs
            value={granularity}
            onValueChange={(value) => setGranularity(value as TransactionTimelineGranularity)}
            className="md:w-auto"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="week" className="text-xs md:text-sm">
                주간 단위
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs md:text-sm">
                월간 단위
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            새로고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">타임라인을 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            타임라인 데이터를 표시할 거래가 충분하지 않습니다. 기간을 늘리거나 필터를 조정해보세요.
          </div>
        ) : (
          <div className="space-y-3">
            {data.entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-border/70 bg-background/80 p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                    <p className="text-xs text-muted-foreground">
                      기간: {entry.periodStart} ~ {entry.periodEnd}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary" className="text-xs">
                      총 {entry.totalTransactions}건
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      매수 {entry.buyCount} · 매도 {entry.sellCount}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      자동 {entry.autoCount} · 수동 {entry.manualCount}
                    </Badge>
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                        entry.netAmountBase >= 0
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-500 dark:text-red-400'
                      )}
                    >
                      {entry.netAmountBase >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      순 {entry.netAmountBase >= 0 ? '+' : '-'}
                      {formatAmount(Math.abs(entry.netAmountBase), 'USD')}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {renderAmounts(entry, 'USD')}
                  {renderAmounts(entry, 'KRW')}
                </div>

                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">주요 거래 종목</p>
                  {renderTopSymbols(entry)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


