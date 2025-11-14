"use client";

import { useMemo } from 'react';
import { Info, TrendingDown, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate, formatShares, formatTime } from '@/lib/utils/formatters';
import type { Transaction } from '@/types';

type TransactionWithMeta = Transaction & {
  displayDate?: string;
  executedAt?: string;
};

type Props = {
  transaction: TransactionWithMeta;
  resolveTransactionCurrency: (transaction: TransactionWithMeta) => 'USD' | 'KRW';
  resolveExecutedAt: (transaction: TransactionWithMeta) => string;
  formatAmount: (amount: number, sourceCurrency: 'USD' | 'KRW') => string;
};

const STATUS_LABEL: Record<'pending' | 'completed' | 'failed', string> = {
  pending: '예정',
  completed: '완료',
  failed: '실패',
};

export function TransactionDetailPopover({
  transaction,
  resolveTransactionCurrency,
  resolveExecutedAt,
  formatAmount,
}: Props) {
  const currency = resolveTransactionCurrency(transaction);
  const executedAt = resolveExecutedAt(transaction);

  const details = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];

    rows.push({
      label: '체결 일시',
      value: `${formatDate(transaction.displayDate ?? transaction.date)} · ${formatTime(executedAt)}`,
    });

    rows.push({
      label: '거래 방식',
      value:
        transaction.purchaseMethod === 'auto'
          ? '자동 투자'
          : transaction.purchaseMethod === 'manual'
          ? '수동 거래'
          : '알 수 없음',
    });

    if (transaction.type === 'dividend') {
      rows.push({
        label: '배당금',
        value: formatAmount(transaction.amount ?? transaction.totalAmount ?? 0, currency),
      });
      return rows;
    }

    const shares = transaction.shares ?? 0;
    if (shares > 0) {
      rows.push({
        label: '거래 수량',
        value: `${formatShares(shares)}주`,
      });
    }

    rows.push({
      label: '체결 단가',
      value: formatAmount(transaction.price ?? 0, currency),
    });

    rows.push({
      label: '거래 금액',
      value: formatAmount(transaction.amount ?? 0, currency),
    });

    if (
      typeof transaction.totalAmount === 'number' &&
      Math.abs((transaction.totalAmount ?? 0) - (transaction.amount ?? 0)) > 1e-6
    ) {
      rows.push({
        label: '총 정산 금액',
        value: formatAmount(transaction.totalAmount, currency),
      });
    }

    if (transaction.fee && transaction.fee > 0) {
      rows.push({
        label: '수수료',
        value: formatAmount(transaction.fee, currency),
      });
    }

    if (transaction.tax && transaction.tax > 0) {
      rows.push({
        label: '세금',
        value: formatAmount(transaction.tax, currency),
      });
    }

    if (transaction.exchangeRate) {
      rows.push({
        label: '적용 환율',
        value: `${transaction.exchangeRate.toFixed(4)} KRW/USD`,
      });
    }

    return rows;
  }, [transaction, currency, executedAt, formatAmount]);

  const status = transaction.status ?? 'completed';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" className="gap-1 text-xs">
          <Info className="h-3.5 w-3.5" />
          상세
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{transaction.symbol}</span>
            <Badge variant={transaction.type === 'buy' ? 'default' : transaction.type === 'sell' ? 'destructive' : 'secondary'}>
              {transaction.type === 'buy' ? (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  매수
                </div>
              ) : transaction.type === 'sell' ? (
                <div className="flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  매도
                </div>
              ) : (
                '배당'
              )}
            </Badge>
          </div>
          <Badge
            variant={status === 'completed' ? 'secondary' : status === 'pending' ? 'outline' : 'destructive'}
            className={status === 'pending' ? 'border-dashed' : undefined}
          >
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        <div className="space-y-2">
          {details.map((item) => (
            <div key={item.label} className="flex items-start justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-right font-medium text-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        {transaction.memo ? (
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">메모</p>
            <p className="mt-1 whitespace-pre-wrap leading-relaxed">{transaction.memo}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
          <span>거래 ID</span>
          <span>{transaction.id ?? '미확인'}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

