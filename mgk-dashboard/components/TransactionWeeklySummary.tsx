"use client";

import { useMemo } from 'react';
import { endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Transaction } from '@/types';

type TransactionWithDisplay = Transaction & {
  displayDate?: string;
  executedAt?: string;
};

type CurrencyConverter = (
  amount: number,
  sourceCurrency: 'USD' | 'KRW'
) => {
  value: number;
  currency: 'USD' | 'KRW';
};

type WeekTotals = {
  key: string;
  start: Date;
  end: Date;
  count: number;
  autoCount: number;
  manualCount: number;
  totalsByCurrency: Record<
    'USD' | 'KRW',
    {
      buy: number;
      sell: number;
    }
  >;
};

type TransactionWeeklySummaryProps = {
  transactions: TransactionWithDisplay[];
  resolveTransactionCurrency: (transaction: TransactionWithDisplay) => 'USD' | 'KRW';
  convertAmount: CurrencyConverter;
  formatAmount: (amount: number, currency: 'USD' | 'KRW') => string;
  weeks?: number;
};

const DEFAULT_WEEKS = 4;

export function TransactionWeeklySummary({
  transactions,
  resolveTransactionCurrency,
  convertAmount,
  formatAmount,
  weeks = DEFAULT_WEEKS,
}: TransactionWeeklySummaryProps) {
  const weeklySummaries = useMemo(() => {
    if (!transactions.length) {
      return [];
    }

    const map = new Map<string, WeekTotals>();

    transactions.forEach((transaction) => {
      if (
        transaction.status === 'pending' ||
        (transaction.type !== 'buy' && transaction.type !== 'sell')
      ) {
        return;
      }

      const rawDate = transaction.displayDate ?? transaction.date;
      if (!rawDate) {
        return;
      }

      const parsed = parseISO(rawDate);
      if (Number.isNaN(parsed.getTime())) {
        return;
      }

      const start = startOfWeek(parsed, { weekStartsOn: 1 });
      const end = endOfWeek(parsed, { weekStartsOn: 1 });
      const key = start.toISOString();

      if (!map.has(key)) {
        map.set(key, {
          key,
          start,
          end,
          count: 0,
          autoCount: 0,
          manualCount: 0,
          totalsByCurrency: {
            USD: { buy: 0, sell: 0 },
            KRW: { buy: 0, sell: 0 },
          },
        });
      }

      const bucket = map.get(key)!;

      const currency = resolveTransactionCurrency(transaction);
      const amount =
        typeof transaction.totalAmount === 'number'
          ? transaction.totalAmount
          : typeof transaction.amount === 'number'
          ? transaction.amount
          : 0;

      const converted = convertAmount(Math.abs(amount), currency);

      bucket.count += 1;
      if (transaction.purchaseMethod === 'auto') {
        bucket.autoCount += 1;
      } else if (transaction.purchaseMethod === 'manual') {
        bucket.manualCount += 1;
      }

      if (transaction.type === 'buy') {
        bucket.totalsByCurrency[converted.currency].buy += converted.value;
      } else if (transaction.type === 'sell') {
        bucket.totalsByCurrency[converted.currency].sell += converted.value;
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .slice(0, weeks)
      .map((entry) => ({
        ...entry,
        label: `${format(entry.start, 'M월 d일', { locale: ko })} ~ ${format(entry.end, 'M월 d일', {
          locale: ko,
        })}`,
      }));
  }, [transactions, resolveTransactionCurrency, convertAmount, weeks]);

  if (!weeklySummaries.length) {
    return null;
  }

  return (
    <Card variant="elevated">
      <CardHeader className="pb-4">
        <CardTitle>주간 거래 집계</CardTitle>
        <CardDescription>최근 {weeks}주간의 매수·매도 흐름과 순현금 변화를 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {weeklySummaries.map((entry) => (
            <div
              key={entry.key}
              className="rounded-md border border-border/70 bg-muted/30 p-3 transition hover:border-primary/40 hover:bg-background/80"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                <Badge variant="secondary" className="text-xs">
                  총 {entry.count}건
                </Badge>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                자동 {entry.autoCount} · 수동 {entry.manualCount}
              </p>

              <div className="mt-3 space-y-2">
                {(Object.entries(entry.totalsByCurrency) as Array<
                  ['USD' | 'KRW', { buy: number; sell: number }]
                >)
                  .filter(([, totals]) => totals.buy > 0 || totals.sell > 0)
                  .map(([currency, totals]) => {
                    const net = totals.sell - totals.buy;
                    return (
                      <div key={`${entry.key}-${currency}`} className="rounded-md bg-background/60 p-2 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-medium">{currency}</span>
                          <span>
                            매수 {formatAmount(totals.buy, currency)} · 매도{' '}
                            {formatAmount(totals.sell, currency)}
                          </span>
                        </div>
                        <div
                          className={`mt-1 text-right text-xs font-semibold ${
                            net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                          }`}
                        >
                          순 {net >= 0 ? '+' : '-'}
                          {formatAmount(Math.abs(net), currency)}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

