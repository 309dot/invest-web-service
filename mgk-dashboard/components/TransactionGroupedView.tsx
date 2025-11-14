import { useMemo } from 'react';
import { Clock, TrendingDown, TrendingUp } from 'lucide-react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionDetailPopover } from '@/components/TransactionDetailPopover';
import { cn } from '@/lib/utils';
import { formatDate, formatShares, formatTime } from '@/lib/utils/formatters';
import type { Transaction } from '@/types';

type TransactionGroupedViewProps = {
  transactions: TransactionRecord[];
  resolveTransactionCurrency: (transaction: TransactionRecord) => 'USD' | 'KRW';
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
  resolveExecutedAt: (transaction: TransactionRecord) => string;
  onSelectTransaction?: (transaction: TransactionRecord) => void;
  selectedTransactionId?: string | null;
};

type TransactionRecord = Transaction & {
  displayDate?: string;
  executedAt?: string;
};

type TransactionGroupedViewProps = {
  transactions: TransactionRecord[];
  resolveTransactionCurrency: (transaction: TransactionRecord) => 'USD' | 'KRW';
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
  resolveExecutedAt: (transaction: TransactionRecord) => string;
};

type GroupAccumulator = {
  symbol: string;
  currency: 'USD' | 'KRW';
  transactions: TransactionRecord[];
  totalCount: number;
  pendingCount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  buyShares: number;
  sellShares: number;
  buyCost: number;
  sellRevenue: number;
  lastDate?: string;
  lastExecutedAt?: string;
};

export function TransactionGroupedView({
  transactions,
  resolveTransactionCurrency,
  formatAmount,
  resolveExecutedAt,
  onSelectTransaction,
  selectedTransactionId,
}: TransactionGroupedViewProps) {
  const groups = useMemo(() => {
    const map = new Map<string, GroupAccumulator>();

    transactions.forEach((transaction) => {
      const symbol = transaction.symbol ?? 'N/A';
      const currency = resolveTransactionCurrency(transaction);
      const key = `${symbol}-${currency}`;

      if (!map.has(key)) {
        map.set(key, {
          symbol,
          currency,
          transactions: [],
          totalCount: 0,
          pendingCount: 0,
          totalBuyAmount: 0,
          totalSellAmount: 0,
          buyShares: 0,
          sellShares: 0,
          buyCost: 0,
          sellRevenue: 0,
        });
      }

      const group = map.get(key)!;
      group.transactions.push(transaction);
      group.totalCount += 1;

      const isPending = transaction.status === 'pending';
      if (isPending) {
        group.pendingCount += 1;
      }

      if (!isPending) {
        const effectiveAmount =
          typeof transaction.totalAmount === 'number'
            ? transaction.totalAmount
            : typeof transaction.amount === 'number'
            ? transaction.amount
            : 0;
        const shares = typeof transaction.shares === 'number' ? transaction.shares : 0;
        const price = typeof transaction.price === 'number' ? transaction.price : 0;

        if (transaction.type === 'buy') {
          group.totalBuyAmount += effectiveAmount;
          group.buyShares += shares;
          group.buyCost += price * shares;
        } else if (transaction.type === 'sell') {
          group.totalSellAmount += effectiveAmount;
          group.sellShares += shares;
          group.sellRevenue += price * shares;
        }
      }

      const candidateDate = transaction.displayDate ?? transaction.date ?? '';
      if (candidateDate) {
        if (!group.lastDate || candidateDate > group.lastDate) {
          group.lastDate = candidateDate;
          group.lastExecutedAt = resolveExecutedAt(transaction);
        } else if (candidateDate === group.lastDate) {
          const existing = group.lastExecutedAt ?? '';
          const candidateExecutedAt = resolveExecutedAt(transaction);
          if (candidateExecutedAt > existing) {
            group.lastExecutedAt = candidateExecutedAt;
          }
        }
      }
    });

    const groupList = Array.from(map.values()).map((group) => {
      const averageBuyPrice =
        group.buyShares > 0 ? group.buyCost / group.buyShares : 0;
      const averageSellPrice =
        group.sellShares > 0 ? group.sellRevenue / group.sellShares : 0;

      const netCashFlow = group.totalSellAmount - group.totalBuyAmount;
      const netShares = group.buyShares - group.sellShares;

      return {
        ...group,
        averageBuyPrice,
        averageSellPrice,
        netCashFlow,
        netShares,
      };
    });

    return groupList.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [transactions, resolveTransactionCurrency, resolveExecutedAt]);

  if (!groups.length) {
    return null;
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>종목별 거래 요약</CardTitle>
        <CardDescription>종목별 거래 흐름과 최근 활동을 한눈에 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Accordion type="multiple" className="divide-y divide-border/80 rounded-md border border-border/60">
          {groups.map((group) => {
            const netCashFlowLabel =
              group.netCashFlow === 0
                ? '현금 변동 없음'
                : group.netCashFlow > 0
                ? `현금 유입 ${formatAmount(group.netCashFlow, group.currency)}`
                : `현금 유출 ${formatAmount(Math.abs(group.netCashFlow), group.currency)}`;

            const netSharesLabel =
              group.netShares === 0
                ? '보유 주식 변동 없음'
                : group.netShares > 0
                ? `${formatShares(group.netShares)}주 순매수`
                : `${formatShares(Math.abs(group.netShares))}주 순매도`;

            const hasPending = group.pendingCount > 0;

            const sortedTransactions = [...group.transactions].sort((a, b) => {
              const dateA = (a.displayDate ?? a.date ?? '').replace(/-/g, '');
              const dateB = (b.displayDate ?? b.date ?? '').replace(/-/g, '');
              if (dateA === dateB) {
                return resolveExecutedAt(b).localeCompare(resolveExecutedAt(a));
              }
              return dateB.localeCompare(dateA);
            });

            return (
              <AccordionItem key={`${group.symbol}-${group.currency}`} value={`${group.symbol}-${group.currency}`}>
                <AccordionTrigger className="gap-4 px-4">
                  <div className="flex flex-1 flex-col gap-2 text-left md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-semibold tracking-tight">{group.symbol}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.totalCount}건
                      </Badge>
                      {hasPending ? (
                        <Badge variant="outline" className="border-dashed text-xs text-muted-foreground">
                          예정 {group.pendingCount}건
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground md:flex-row md:items-center md:gap-3">
                      <span className={cn(group.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                        {netCashFlowLabel}
                      </span>
                      <span>{netSharesLabel}</span>
                      {group.lastDate ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          최근 {formatDate(group.lastDate)}{' '}
                          {group.lastExecutedAt ? formatTime(group.lastExecutedAt) : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="space-y-4 rounded-md bg-muted/40 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-border/60 bg-background/80 p-3">
                        <p className="text-xs font-medium text-muted-foreground">총 매수</p>
                        <p className="mt-2 text-lg font-semibold text-emerald-600">
                          {formatAmount(group.totalBuyAmount, group.currency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {group.buyShares > 0
                            ? `${formatShares(group.buyShares)}주 · 평균 ${formatAmount(
                                group.averageBuyPrice,
                                group.currency
                              )}`
                            : '완료된 매수 거래 없음'}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background/80 p-3">
                        <p className="text-xs font-medium text-muted-foreground">총 매도</p>
                        <p className="mt-2 text-lg font-semibold text-red-500">
                          {formatAmount(group.totalSellAmount, group.currency)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {group.sellShares > 0
                            ? `${formatShares(group.sellShares)}주 · 평균 ${formatAmount(
                                group.averageSellPrice,
                                group.currency
                              )}`
                            : '완료된 매도 거래 없음'}
                        </p>
                      </div>
                      <div className="rounded-md border border-border/60 bg-background/80 p-3">
                        <p className="text-xs font-medium text-muted-foreground">포지션 변화</p>
                        <p
                          className={cn(
                            'mt-2 text-lg font-semibold',
                            group.netShares >= 0 ? 'text-emerald-600' : 'text-red-500'
                          )}
                        >
                          {netSharesLabel}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{netCashFlowLabel}</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-md border border-border/60 bg-background">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">날짜</th>
                          <th className="px-3 py-2 text-left">시간</th>
                          <th className="px-3 py-2 text-left">유형</th>
                          <th className="px-3 py-2 text-left">요약</th>
                          <th className="px-3 py-2 text-left">상세</th>
                          <th className="px-3 py-2 text-right">액션</th>
                        </tr>
                        </thead>
                        <tbody>
                          {sortedTransactions.map((transaction) => {
                            const currency = resolveTransactionCurrency(transaction);
                            const isPending = transaction.status === 'pending';
                            const shares =
                              typeof transaction.shares === 'number' ? transaction.shares : 0;
                            const amount =
                              typeof transaction.totalAmount === 'number'
                                ? transaction.totalAmount
                                : typeof transaction.amount === 'number'
                                ? transaction.amount
                                : 0;

                            const summaryLine = isPending
                              ? transaction.purchaseMethod === 'auto'
                                ? `자동 투자 예정 → ${formatAmount(amount, currency)}`
                                : `예정 거래 → ${formatAmount(amount, currency)}`
                              : `${transaction.type === 'sell' ? '매도' : '매수'} ${
                                  shares > 0
                                    ? `${formatShares(shares)}주 @ ${formatAmount(transaction.price ?? 0, currency)}`
                                    : '금액'
                                } → ${formatAmount(amount, currency)}`;

                            const detailLine = isPending
                              ? transaction.purchaseMethod === 'auto'
                                ? '자동 투자 예정 금액입니다.'
                                : '예정 거래 금액입니다.'
                              : transaction.memo || '-';

                            const isActive = selectedTransactionId
                              ? selectedTransactionId === transaction.id
                              : false;

                            return (
                              <tr
                                key={transaction.id ?? `${transaction.symbol}-${transaction.date}`}
                                className={cn(
                                  'transition-colors',
                                  onSelectTransaction ? 'cursor-pointer hover:bg-muted/60' : undefined,
                                  isActive ? 'bg-primary/10 hover:bg-primary/20' : undefined
                                )}
                                onClick={() => {
                                  if (onSelectTransaction) {
                                    onSelectTransaction(transaction);
                                  }
                                }}
                              >
                                <td className="px-3 py-2">
                                  {formatDate(transaction.displayDate ?? transaction.date)}
                                </td>
                                <td className="px-3 py-2">{formatTime(resolveExecutedAt(transaction))}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={transaction.type === 'buy' ? 'default' : 'destructive'}
                                      className="gap-1"
                                    >
                                      {transaction.type === 'buy' ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      {transaction.type === 'buy' ? '매수' : '매도'}
                                    </Badge>
                                    {transaction.status === 'pending' ? (
                                      <Badge variant="outline" className="border-dashed text-xs">
                                        예정
                                      </Badge>
                                    ) : transaction.purchaseMethod === 'auto' ? (
                                      <Badge variant="secondary" className="text-xs">
                                        자동
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-sm">
                                  <div
                                    className={cn(
                                      'font-medium',
                                      isPending
                                        ? 'text-muted-foreground'
                                        : transaction.type === 'sell'
                                        ? 'text-red-500'
                                        : 'text-emerald-600'
                                    )}
                                  >
                                    {summaryLine}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  {detailLine}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <TransactionDetailPopover
                                    transaction={transaction}
                                    resolveTransactionCurrency={resolveTransactionCurrency}
                                    resolveExecutedAt={resolveExecutedAt}
                                    formatAmount={formatAmount}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}


