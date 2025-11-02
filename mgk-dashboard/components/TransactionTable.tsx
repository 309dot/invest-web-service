"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils/formatters';
import type { Transaction } from '@/types';

interface TransactionTableProps {
  transactions: Transaction[];
  currency: 'USD' | 'KRW';
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

type FilterType = 'all' | 'auto' | 'manual';

export function TransactionTable({
  transactions,
  currency,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const resolveRowCurrency = (transaction: Transaction): 'USD' | 'KRW' => {
    if (transaction.currency === 'KRW' || transaction.currency === 'USD') {
      return transaction.currency;
    }
    return /^[0-9]/.test(transaction.symbol) ? 'KRW' : currency;
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'all') return true;
    return t.purchaseMethod === filter;
  });

  const autoCount = transactions.filter((t) => t.purchaseMethod === 'auto').length;
  const manualCount = transactions.filter((t) => t.purchaseMethod === 'manual').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            총 {transactions.length}건 (자동: {autoCount}, 수동: {manualCount})
          </div>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="auto">자동만</SelectItem>
            <SelectItem value="manual">수동만</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          거래 내역이 없습니다.
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>유형</TableHead>
                <TableHead className="text-right">수량</TableHead>
                <TableHead className="text-right">가격</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>구매방식</TableHead>
                <TableHead>메모</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell className="font-medium">
                    {formatDate(transaction.date, 'yyyy-MM-dd')}
                  </TableCell>
                  <TableCell>
                    {transaction.type === 'buy' ? (
                      <Badge variant="default" className="gap-1">
                        <TrendingUp className="h-3 w-3" />
                        매수
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <TrendingDown className="h-3 w-3" />
                        매도
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.shares.toFixed(4)}주
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(transaction.price, resolveRowCurrency(transaction))}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(transaction.amount, resolveRowCurrency(transaction))}
                  </TableCell>
                  <TableCell>
                    {transaction.purchaseMethod === 'auto' ? (
                      <Badge variant="outline">자동</Badge>
                    ) : (
                      <Badge variant="secondary">수동</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {transaction.memo || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {transaction.purchaseMethod === 'manual' ? (
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(transaction)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(transaction)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">자동 생성</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

