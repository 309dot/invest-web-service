"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard, StatCardHeader, StatCardTitle, StatCardValue, StatCardContent, StatCardDescription } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  Filter,
  Calendar,
  Trash2,
  MoreVertical,
  ChevronDown,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency, formatDate, formatPercent, formatTime, formatShares, getProfitTextClass, PROFIT_TEXT_NEGATIVE } from '@/lib/utils/formatters';
import { TransactionSummaryCards } from '@/components/TransactionSummaryCards';
import { TransactionTimeline } from '@/components/TransactionTimeline';
import { TransactionDetailPopover } from '@/components/TransactionDetailPopover';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import type { Transaction, AutoInvestFrequency, TransactionStats } from '@/types';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';

const FILTER_STORAGE_KEY = 'transactions:filters';

type UpcomingAutoInvest = {
  positionId: string;
  symbol: string;
  amount: number;
  currency: 'USD' | 'KRW';
  scheduledDate: string;
  displayDate: string;
  frequency: AutoInvestFrequency;
  executed: boolean;
  isToday: boolean;
};

type TransactionWithDisplay = Transaction & {
  displayDate?: string;
  executedAt?: string;
};

type TransactionStatusType = 'pending' | 'completed' | 'failed' | 'cancelled';

const frequencyLabel: Record<AutoInvestFrequency, string> = {
  daily: '매일',
  weekly: '매주',
  biweekly: '격주',
  monthly: '매월',
  quarterly: '분기',
};

const statusFilterOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
  { value: 'cancelled', label: '취소' },
];

const statusLabelMap: Record<TransactionStatusType, string> = {
  pending: '대기',
  completed: '완료',
  failed: '실패',
  cancelled: '취소',
};

const statusBadgeClassMap: Record<TransactionStatusType, string> = {
  pending: 'border-amber-500 text-amber-600 border-dashed bg-amber-500/10 dark:text-amber-300 dark:border-amber-400',
  completed: 'bg-emerald-600 hover:bg-emerald-600 text-white',
  failed: 'border-red-500 text-red-600 bg-red-500/10 dark:text-red-400 dark:border-red-500',
  cancelled: 'border-muted-foreground text-muted-foreground bg-muted/10',
};

const statusBadgeVariantMap: Record<TransactionStatusType, 'default' | 'outline'> = {
  pending: 'outline',
  completed: 'default',
  failed: 'outline',
  cancelled: 'outline',
};

function resolveTransactionStatus(transaction: TransactionWithDisplay): TransactionStatusType {
  const status = transaction.status;
  if (status === 'pending' || status === 'completed' || status === 'failed' || status === 'cancelled') {
    return status;
  }
  if (transaction.pending) {
    return 'pending';
  }
  return 'completed';
}

export default function TransactionsPage() {
  const {
    formatAmount,
    displayCurrency,
  } = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<TransactionWithDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [upcomingAutoInvests, setUpcomingAutoInvests] = useState<UpcomingAutoInvest[]>([]);
  const [expandedSymbols, setExpandedSymbols] = useState<Record<string, boolean>>({});
  const [selectedMethod, setSelectedMethod] = useState<'all' | 'auto' | 'manual'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // 필터
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 삭제
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDisplay | null>(null);

  const resolveExecutedAt = useCallback((transaction: TransactionWithDisplay): string => {
    if (transaction.executedAt) {
      return transaction.executedAt;
    }
    const createdAt: any = transaction.createdAt as any;
    if (createdAt && typeof createdAt === 'object' && 'seconds' in createdAt) {
      return new Date(createdAt.seconds * 1000).toISOString();
    }
    return `${transaction.date}T00:00:00`;
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const defaultPortfolioId = useMemo(() => {
    if (!user) return 'main';
    return deriveDefaultPortfolioId(user.uid);
  }, [user]);

  useEffect(() => {
    if (filtersInitialized) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          selectedSymbol: string;
          selectedType: string;
          selectedStatus: string;
          selectedMethod: 'all' | 'auto' | 'manual';
          startDate: string;
          endDate: string;
          searchTerm: string;
        }>;
        if (saved.selectedSymbol) {
          setSelectedSymbol(saved.selectedSymbol);
        }
        if (saved.selectedType === 'buy' || saved.selectedType === 'sell' || saved.selectedType === 'all') {
          setSelectedType(saved.selectedType);
        }
        if (
          saved.selectedStatus === 'pending' ||
          saved.selectedStatus === 'completed' ||
          saved.selectedStatus === 'failed' ||
          saved.selectedStatus === 'cancelled' ||
          saved.selectedStatus === 'all'
        ) {
          setSelectedStatus(saved.selectedStatus);
        }
        if (saved.selectedMethod) {
          setSelectedMethod(saved.selectedMethod);
        }
        if (typeof saved.startDate === 'string') {
          setStartDate(saved.startDate);
        }
        if (typeof saved.endDate === 'string') {
          setEndDate(saved.endDate);
        }
        if (typeof saved.searchTerm === 'string') {
          setSearchTerm(saved.searchTerm);
        }
      }
    } catch (error) {
      console.warn('Failed to restore transaction filters:', error);
    } finally {
      setFiltersInitialized(true);
    }
  }, [filtersInitialized]);

  useEffect(() => {
    if (!filtersInitialized || typeof window === 'undefined') {
      return;
    }
    const payload = {
      selectedSymbol,
      selectedType,
      selectedStatus,
      selectedMethod,
      startDate,
      endDate,
      searchTerm,
    };
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist transaction filters:', error);
    }
  }, [selectedSymbol, selectedType, selectedStatus, selectedMethod, startDate, endDate, searchTerm, filtersInitialized]);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      if (!user) {
        setTransactions([]);
        setStats(null);
        return;
      }
      const params = new URLSearchParams({
        portfolioId: defaultPortfolioId,
        includeStats: 'true',
        userId: user.uid,
      });

      if (selectedSymbol !== 'all') {
        params.append('symbol', selectedSymbol);
      }
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }
      if (selectedMethod !== 'all') {
        params.append('purchaseMethod', selectedMethod);
      }

      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions((data.transactions || []) as TransactionWithDisplay[]);
        setStats(data.stats || null);
        setUpcomingAutoInvests(data.upcomingAutoInvests || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, defaultPortfolioId, selectedSymbol, selectedType, selectedStatus, startDate, endDate, selectedMethod]);

  useEffect(() => {
    if (user && filtersInitialized) {
      fetchTransactions();
    }
  }, [user, fetchTransactions, filtersInitialized]);

  const handleDeleteClick = (transaction: TransactionWithDisplay) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete) return;
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const portfolioId = deriveDefaultPortfolioId(user.uid);
      const response = await fetch(
        `/api/transactions/${transactionToDelete.id}?portfolioId=${portfolioId}&userId=${user.uid}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        fetchTransactions();
        setDeleteDialogOpen(false);
        setTransactionToDelete(null);
      } else {
        const error = await response.json();
        alert(error.error || '거래 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('거래 삭제 중 오류가 발생했습니다.');
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 종목 목록 추출
  const symbols = Array.from(new Set(transactions.map((t) => t.symbol))).sort();
  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, TransactionWithDisplay[]>();
    filteredTransactions.forEach((transaction) => {
      const key = transaction.symbol || '기타';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(transaction);
    });
    return Array.from(groups.entries());
  }, [filteredTransactions]);
  const resolveTransactionCurrency = (transaction: TransactionWithDisplay): 'USD' | 'KRW' => {
    const symbol = transaction.symbol?.trim() ?? '';
    if (/^[0-9]{4,6}$/.test(symbol)) {
      return 'KRW';
    }

    if (typeof transaction.currency === 'string') {
      const upper = transaction.currency.toUpperCase();
      if (upper === 'KRW' || upper === 'USD') {
        return upper;
      }
    }

    return 'USD';
  };

  const pendingTransactions = useMemo(
    () => transactions.filter((transaction) => resolveTransactionStatus(transaction) === 'pending'),
    [transactions]
  );

  useEffect(() => {
    setExpandedSymbols({});
  }, [selectedMethod, selectedSymbol, selectedType, selectedStatus, startDate, endDate]);

  const formatTransactionSummary = useCallback(
    (transaction: TransactionWithDisplay): string => {
      const currency = resolveTransactionCurrency(transaction);
      const actionLabel = transaction.type === 'sell' ? '매도' : '매수';
      const sharesValue = typeof transaction.shares === 'number' ? transaction.shares : 0;
      const sharesLabel = `${formatShares(Math.abs(sharesValue))}주`;
      const unitPrice =
        typeof transaction.price === 'number'
          ? transaction.price
          : sharesValue !== 0
          ? (transaction.amount ?? 0) / sharesValue
          : 0;
      const totalAmount =
        typeof transaction.totalAmount === 'number'
          ? transaction.totalAmount
          : typeof transaction.amount === 'number'
          ? transaction.amount
          : unitPrice * sharesValue;

      const priceLabel = formatAmount(Math.abs(unitPrice), currency);
      const totalLabel = formatAmount(Math.abs(totalAmount), currency);

      return `${actionLabel} ${sharesLabel} @ ${priceLabel} → ${totalLabel}`;
    },
    [formatAmount]
  );

  const filteredTransactions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return transactions;
    }
    return transactions.filter((transaction) => {
      const symbol = transaction.symbol?.toLowerCase() ?? '';
      const memo = transaction.memo?.toLowerCase() ?? '';
      const type = transaction.type?.toLowerCase() ?? '';
      const status = resolveTransactionStatus(transaction).toLowerCase();
      const currency = (transaction.currency ?? '').toString().toLowerCase();
      const purchaseMethod = (transaction.purchaseMethod ?? '').toString().toLowerCase();
      const date = transaction.date?.toLowerCase() ?? '';
      return (
        symbol.includes(term) ||
        memo.includes(term) ||
        type.includes(term) ||
        status.includes(term) ||
        currency.includes(term) ||
        purchaseMethod.includes(term) ||
        date.includes(term)
      );
    });
  }, [transactions, searchTerm]);

  const handleExportCsv = useCallback(() => {
    if (!filteredTransactions.length) {
      window.alert('내보낼 거래가 없습니다.');
      return;
    }

    const headers = [
      'id',
      'symbol',
      'type',
      'status',
      'purchaseMethod',
      'shares',
      'price',
      'amount',
      'totalAmount',
      'fee',
      'tax',
      'currency',
      'date',
      'executedAt',
      'scheduledDate',
      'memo',
    ];

    const rows = filteredTransactions.map((transaction) => {
      const status = resolveTransactionStatus(transaction);
      const executedAt = resolveExecutedAt(transaction);
      const currency = resolveTransactionCurrency(transaction);

      return [
        transaction.id ?? '',
        transaction.symbol ?? '',
        transaction.type ?? '',
        status,
        transaction.purchaseMethod ?? '',
        transaction.shares ?? '',
        transaction.price ?? '',
        transaction.amount ?? '',
        transaction.totalAmount ?? '',
        transaction.fee ?? '',
        transaction.tax ?? '',
        currency,
        transaction.date ?? '',
        executedAt,
        transaction.scheduledDate ?? '',
        transaction.memo ?? '',
      ];
    });

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const str = `${value ?? ''}`;
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:T]/g, '-').split('.')[0];
    link.href = url;
    link.download = `transactions_${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredTransactions, resolveExecutedAt, resolveTransactionStatus, resolveTransactionCurrency]);

  const pendingTransactionKeys = useMemo(() => {
    const keySet = new Set<string>();
    pendingTransactions.forEach((transaction) => {
      const key = `${transaction.positionId ?? transaction.symbol}:${transaction.scheduledDate ?? transaction.date}`;
      keySet.add(key);
    });
    return keySet;
  }, [pendingTransactions]);

  const filteredUpcomingAutoInvests = useMemo(() => {
    if (pendingTransactionKeys.size === 0) {
      return upcomingAutoInvests;
    }
    return upcomingAutoInvests.filter((plan) => {
      const key = `${plan.positionId}:${plan.scheduledDate}`;
      return !pendingTransactionKeys.has(key);
    });
  }, [upcomingAutoInvests, pendingTransactionKeys]);

  const methodDescriptionMap: Record<'all' | 'auto' | 'manual', string> = {
    all: '자동 투자와 수동 입력 거래를 함께 확인합니다.',
    auto: '자동 투자 엔진이 생성한 거래만 모아서 보여줍니다.',
    manual: '사용자가 직접 기록한 거래만 확인할 수 있습니다.',
  };
  const methodDescription = methodDescriptionMap[selectedMethod];

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/5 p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
          {/* 헤더 */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">거래 이력</h1>
              <p className="text-muted-foreground">모든 매수/매도 거래 기록</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!filteredTransactions.length}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                CSV 내보내기
              </Button>
            </div>
          </div>

          {selectedMethod !== 'manual' &&
            (pendingTransactions.length > 0 || filteredUpcomingAutoInvests.length > 0) && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">자동 투자 일정</CardTitle>
                <CardDescription>
                  실행 대기 중인 자동 투자와 예정된 스케줄을 확인하세요.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingTransactions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">실행 대기 중</h4>
                    {pendingTransactions.map((transaction) => {
                      const currency = resolveTransactionCurrency(transaction);
                      const scheduled = transaction.scheduledDate ?? transaction.date;
                      const createdAt = resolveExecutedAt(transaction);
                      return (
                        <div
                          key={`pending-${transaction.id}`}
                          className="flex flex-col gap-1 rounded-md border border-yellow-200/60 bg-yellow-50/60 p-3 md:flex-row md:items-center md:justify-between dark:border-yellow-500/40 dark:bg-yellow-500/10"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <span>{transaction.symbol}</span>
                              <Badge variant="outline" className={`text-xs ${statusBadgeClassMap.pending}`}>
                                {statusLabelMap.pending}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              예정일: {formatDate(scheduled)} · 금액{' '}
                              {formatAmount(transaction.totalAmount ?? transaction.amount, currency)}
                            </p>
                          </div>
                          <div className="flex flex-col md:items-end md:text-right gap-1 text-xs text-muted-foreground">
                            <span>생성: {formatDate(createdAt)} {formatTime(createdAt)}</span>
                            <span>포지션: {transaction.positionId ?? '미지정'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredUpcomingAutoInvests.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">예정 스케줄</h4>
                    {filteredUpcomingAutoInvests.map((plan) => {
                      const statusBadge = plan.executed ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">구매 완료</Badge>
                      ) : plan.isToday ? (
                        <Badge variant="outline" className="border-dashed">오늘 예정</Badge>
                      ) : (
                        <Badge variant="outline" className="border-dashed">예정</Badge>
                      );

                      const helperText = plan.executed
                        ? '오늘 예정된 자동 투자가 실행되었습니다.'
                        : plan.isToday
                        ? '장 마감 시 자동 구매가 실행됩니다.'
                        : `${formatDate(plan.displayDate)}에 자동 투자 예정입니다.`;

                      return (
                        <div
                          key={`${plan.positionId}-${plan.scheduledDate}`}
                          className="flex flex-col gap-1 rounded-md border border-primary/10 bg-background/60 p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                              <span>{plan.symbol}</span>
                              <Badge variant="secondary" className="uppercase">
                                {frequencyLabel[plan.frequency]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              예정일: {formatDate(plan.displayDate)} · 금액 {formatAmount(plan.amount, plan.currency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {statusBadge}
                            <span className="text-muted-foreground">{helperText}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 통계 카드 */}
          {stats ? (
            <div className="space-y-4">
              <TransactionSummaryCards
                stats={stats}
                displayCurrency={displayCurrency}
                formatAmount={formatAmount}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Tabs
              value={selectedMethod}
              onValueChange={(value) => setSelectedMethod((value as 'all' | 'auto' | 'manual') ?? 'all')}
            >
              <TabsList className="grid w-full grid-cols-3 bg-muted/40">
                <TabsTrigger value="all" className="flex-1 text-xs md:text-sm">
                  전체
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex-1 text-xs md:text-sm">
                  수동 거래
                </TabsTrigger>
                <TabsTrigger value="auto" className="flex-1 text-xs md:text-sm">
                  자동 투자
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">{methodDescription}</p>
          </div>

          {/* 필터 */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5 opacity-60" />
                필터
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-6">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="transaction-search">검색</Label>
                  <Input
                    id="transaction-search"
                    placeholder="심볼, 메모, 상태 등을 입력하세요"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>종목</Label>
                  <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {symbols.map((symbol) => (
                        <SelectItem key={symbol} value={symbol}>
                          {symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>거래 유형</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="buy">매수</SelectItem>
                      <SelectItem value="sell">매도</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>거래 상태</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusFilterOptions.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>시작일</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>종료일</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {(selectedSymbol !== 'all' ||
                selectedType !== 'all' ||
                selectedStatus !== 'all' ||
                startDate ||
                endDate ||
                searchTerm.trim()) && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => {
                    setSelectedSymbol('all');
                    setSelectedType('all');
                    setSelectedStatus('all');
                    setStartDate('');
                    setEndDate('');
                    setSearchTerm('');
                  }}
                >
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>

          {user ? (
            <TransactionTimeline
              userId={user.uid}
              portfolioId={defaultPortfolioId}
              purchaseMethod={selectedMethod}
              selectedSymbol={selectedSymbol !== 'all' ? selectedSymbol : undefined}
              selectedType={selectedType !== 'all' ? (selectedType as 'buy' | 'sell') : undefined}
              startDate={startDate || undefined}
              endDate={endDate || undefined}
              formatAmount={formatAmount}
            />
          ) : null}

          {/* 거래 이력 */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle>거래 목록</CardTitle>
              <CardDescription>
                {filteredTransactions.length}개의 거래 (총 {transactions.length}건)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>거래 이력이 없습니다.</p>
                </div>
              ) : (
                <>
                  {/* 모바일: 카드 형태 */}
                  <div className="md:hidden space-y-3">
                    {filteredTransactions.map((transaction) => {
                      const status = resolveTransactionStatus(transaction);
                      const isPendingStatus = status === 'pending';
                      const baseTone =
                        transaction.type === 'buy'
                          ? 'border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10'
                          : 'border-l-red-500 bg-red-50/30 dark:bg-red-950/10';
                      const cardToneClass = isPendingStatus
                        ? 'border-l-amber-500 bg-amber-50/80 dark:bg-amber-500/10'
                        : baseTone;
                      const methodLabel = transaction.purchaseMethod === 'auto' ? '자동' : '수동';
                      const methodBadgeVariant =
                        transaction.purchaseMethod === 'auto' ? 'secondary' : 'outline';
                      const summaryText = formatTransactionSummary(transaction);

                      return (
                        <Card key={transaction.id} className={`border-l-4 ${cardToneClass}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-semibold">{transaction.symbol}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {formatDate(transaction.displayDate ?? transaction.date)} · {formatTime(resolveExecutedAt(transaction))}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  variant={transaction.type === 'buy' ? 'default' : 'destructive'}
                                  className="flex items-center gap-1"
                                >
                                  {transaction.type === 'buy' ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {transaction.type === 'buy' ? '매수' : '매도'}
                                </Badge>
                                <Badge variant={methodBadgeVariant} className="text-xs">
                                  {methodLabel}
                                </Badge>
                                <Badge
                                  variant={statusBadgeVariantMap[status]}
                                  className={`text-xs ${statusBadgeClassMap[status]}`}
                                >
                                  {statusLabelMap[status]}
                                </Badge>
                              </div>
                            </div>

                            <p className="text-sm font-semibold text-foreground">
                              {summaryText}
                            </p>

                            {transaction.memo && (
                              <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                                {transaction.memo}
                              </p>
                            )}

                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <TransactionDetailPopover
                                transaction={transaction}
                                resolveTransactionCurrency={resolveTransactionCurrency}
                                resolveExecutedAt={resolveExecutedAt}
                                formatAmount={formatAmount}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(transaction)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* 데스크톱: 종목별 아코디언 */}
                  <div className="hidden md:block space-y-4">
                    {groupedTransactions
                      .filter(([symbol]) => selectedSymbol === 'all' || symbol === selectedSymbol)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([symbol, symbolTransactions]) => {
                        if (symbolTransactions.length === 0) {
                          return null;
                        }

                        const sortedTransactions = [...symbolTransactions].sort((a, b) => {
                          const aTime = new Date(resolveExecutedAt(a)).getTime();
                          const bTime = new Date(resolveExecutedAt(b)).getTime();
                          return bTime - aTime;
                        });

                        const currency = resolveTransactionCurrency(sortedTransactions[0]);
                        let totalBuy = 0;
                        let totalSell = 0;
                        let pendingCount = 0;

                        sortedTransactions.forEach((transaction) => {
                          const amount = transaction.totalAmount ?? transaction.amount ?? 0;
                          if (transaction.type === 'buy') {
                            totalBuy += amount;
                          } else {
                            totalSell += amount;
                          }
                          if (resolveTransactionStatus(transaction) === 'pending') {
                            pendingCount += 1;
                          }
                        });

                        const netValue = totalSell - totalBuy;
                        const netSummary =
                          netValue === 0
                            ? '순거래 없음'
                            : netValue > 0
                            ? `순매도 ${formatAmount(Math.abs(netValue), currency)}`
                            : `순매수 ${formatAmount(Math.abs(netValue), currency)}`;
                        const isExpanded = expandedSymbols[symbol] ?? true;

                        return (
                          <div
                            key={symbol}
                            className="rounded-lg border border-muted-foreground/20 bg-background/80 backdrop-blur-sm shadow-sm"
                          >
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-4 rounded-t-lg px-4 py-3 text-left transition hover:bg-muted/30"
                              onClick={() =>
                                setExpandedSymbols((prev) => ({
                                  ...prev,
                                  [symbol]: !(prev[symbol] ?? true),
                                }))
                              }
                            >
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{symbol}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {sortedTransactions.length}건
                                  </Badge>
                                  {pendingCount > 0 ? (
                                    <Badge className="text-xs bg-amber-500/15 text-amber-600 dark:text-amber-300">
                                      대기 {pendingCount}
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <span>총 매수 {formatAmount(totalBuy, currency)}</span>
                                  <span>총 매도 {formatAmount(totalSell, currency)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium ${getProfitTextClass(netValue)}`}>
                                  {netSummary}
                                </span>
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </button>

                            {isExpanded ? (
                              <div className="space-y-3 border-t border-muted-foreground/20 px-4 py-4">
                                {sortedTransactions.map((transaction) => {
                                  const status = resolveTransactionStatus(transaction);
                                  const txnCurrency = resolveTransactionCurrency(transaction);
                                  const amountLabel = formatAmount(
                                    transaction.totalAmount ?? transaction.amount ?? 0,
                                    txnCurrency
                                  );
                                  const executedAt = resolveExecutedAt(transaction);
                                  const methodLabel = transaction.purchaseMethod === 'auto' ? '자동' : '수동';
                                  const methodBadgeVariant =
                                    transaction.purchaseMethod === 'auto' ? 'secondary' : 'outline';
                                  const summaryText = formatTransactionSummary(transaction);

                                  return (
                                    <div
                                      key={transaction.id}
                                      className="rounded-lg border border-muted-foreground/30 bg-background/90 p-4 shadow-sm transition hover:border-primary/30 hover:bg-background"
                                    >
                                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge
                                            variant={transaction.type === 'buy' ? 'default' : 'destructive'}
                                            className="flex items-center gap-1"
                                          >
                                            {transaction.type === 'buy' ? (
                                              <TrendingUp className="h-3 w-3" />
                                            ) : (
                                              <TrendingDown className="h-3 w-3" />
                                            )}
                                            {transaction.type === 'buy' ? '매수' : '매도'}
                                          </Badge>
                                          <Badge variant={methodBadgeVariant} className="text-xs">
                                            {methodLabel}
                                          </Badge>
                                          <Badge
                                            variant={statusBadgeVariantMap[status]}
                                            className={`text-xs ${statusBadgeClassMap[status]}`}
                                          >
                                            {statusLabelMap[status]}
                                          </Badge>
                                          {transaction.pending ? (
                                            <Badge variant="outline" className="border-dashed text-xs">
                                              자동 투자 대기
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                          <span>거래일 {formatDate(transaction.date)}</span>
                                          <span>
                                            등록 {formatDate(executedAt)} {formatTime(executedAt)}
                                          </span>
                                          {transaction.scheduledDate && status === 'pending' ? (
                                            <span>예정일 {formatDate(transaction.scheduledDate)}</span>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="mt-2 text-sm font-semibold text-foreground">
                                        {summaryText}
                                      </div>

                                      <div className="mt-3 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            주식 수
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {formatShares(transaction.shares)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            평균 가격
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {formatAmount(transaction.price ?? 0, txnCurrency)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            거래 금액
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {formatAmount(transaction.amount ?? 0, txnCurrency)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            총 금액
                                          </span>
                                          <span className="font-semibold text-foreground">{amountLabel}</span>
                                        </div>
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            수수료
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {formatAmount(transaction.fee ?? 0, txnCurrency)}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            세금
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {formatAmount(transaction.tax ?? 0, txnCurrency)}
                                          </span>
                                        </div>
                                        <div className="sm:col-span-2 lg:col-span-4">
                                          <span className="block text-[11px] uppercase tracking-wide">
                                            메모
                                          </span>
                                          <span className="font-medium text-foreground">
                                            {transaction.memo ?? '-'}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <TransactionDetailPopover
                                          transaction={transaction}
                                          resolveTransactionCurrency={resolveTransactionCurrency}
                                          resolveExecutedAt={resolveExecutedAt}
                                          formatAmount={formatAmount}
                                        />
                                        <div className="flex justify-end gap-2">
                                          <Button
                                            variant="outline"
                                            size="xs"
                                            className="h-7"
                                            onClick={() => handleDeleteClick(transaction)}
                                          >
                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            삭제
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="outline" size="icon" className="h-7 w-7">
                                                <MoreVertical className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                              <DropdownMenuItem
                                                onClick={() => alert('수정 기능은 개발 예정입니다.')}
                                              >
                                                거래 수정
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => alert('재사용 기능은 준비 중입니다.')}
                                              >
                                                동일 거래 재사용
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>거래 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 거래를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              {transactionToDelete && (
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="text-sm">
                    <p><strong>종목:</strong> {transactionToDelete.symbol}</p>
                    <p><strong>유형:</strong> {transactionToDelete.type === 'buy' ? '매수' : '매도'}</p>
                    <p><strong>날짜:</strong> {formatDate(transactionToDelete.displayDate ?? transactionToDelete.date)}</p>
                    <p><strong>시간:</strong> {formatTime(resolveExecutedAt(transactionToDelete))}</p>
                    <p><strong>금액:</strong> {formatAmount(transactionToDelete.totalAmount, resolveTransactionCurrency(transactionToDelete!))}</p>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

