"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Download,
  Calendar,
  DollarSign,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import type { Transaction } from '@/types';

export default function TransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  // 필터
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 삭제
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      if (!user) {
        setTransactions([]);
        setStats(null);
        return;
      }
      const params = new URLSearchParams({
        portfolioId: 'main',
        includeStats: 'true',
        userId: user.uid,
      });

      if (selectedSymbol !== 'all') {
        params.append('symbol', selectedSymbol);
      }
      if (selectedType !== 'all') {
        params.append('type', selectedType);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await fetch(`/api/transactions?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setStats(data.stats || null);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, selectedSymbol, selectedType, startDate, endDate]);

  const handleDeleteClick = (transaction: Transaction) => {
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
      const response = await fetch(
        `/api/transactions/${transactionToDelete.id}?portfolioId=main&userId=${user.uid}`,
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

  const resolveTransactionCurrency = (transaction: Transaction): 'USD' | 'KRW' => {
    if (transaction.currency === 'KRW' || transaction.currency === 'USD') {
      return transaction.currency;
    }
    return /^[0-9]/.test(transaction.symbol) ? 'KRW' : 'USD';
  };

  return (
    <>
      <Header />
      <div className="min-h-screen p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">거래 이력</h1>
              <p className="text-muted-foreground">
                모든 매수/매도 거래 기록
              </p>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              내보내기
            </Button>
          </div>

          {/* 통계 카드 */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    총 거래 횟수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.transactionCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    총 매수 금액
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(stats.totalBuyAmount, 'USD')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalBuys.toFixed(2)} 주
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    총 매도 금액
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats.totalSellAmount, 'USD')}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalSells.toFixed(2)} 주
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    평균 매수가
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(stats.averageBuyPrice, 'USD')}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                필터
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
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

              {(selectedSymbol !== 'all' || selectedType !== 'all' || startDate || endDate) && (
                <Button
                  variant="ghost"
                  className="mt-4"
                  onClick={() => {
                    setSelectedSymbol('all');
                    setSelectedType('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 거래 이력 */}
          <Card>
            <CardHeader>
              <CardTitle>거래 목록</CardTitle>
              <CardDescription>
                {transactions.length}개의 거래
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>거래 이력이 없습니다.</p>
                </div>
              ) : (
                <>
                  {/* 모바일: 카드 형태 */}
                  <div className="md:hidden space-y-3">
                    {transactions.map((transaction) => (
                      <Card key={transaction.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold">{transaction.symbol}</h4>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(transaction.date)}
                              </p>
                            </div>
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
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">주식 수</p>
                              <p className="font-medium">{transaction.shares.toFixed(4)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">가격</p>
                              <p className="font-medium">{formatCurrency(transaction.price, resolveTransactionCurrency(transaction))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">거래 금액</p>
                              <p className="font-medium">{formatCurrency(transaction.amount, resolveTransactionCurrency(transaction))}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">총 금액</p>
                              <p className="font-semibold">{formatCurrency(transaction.totalAmount, resolveTransactionCurrency(transaction))}</p>
                            </div>
                          </div>

                          {transaction.memo && (
                            <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                              {transaction.memo}
                            </p>
                          )}

                          <div className="mt-3 pt-3 border-t flex justify-end">
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
                    ))}
                  </div>

                  {/* 데스크톱: 테이블 */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">날짜</th>
                          <th className="text-left py-3 px-4 font-medium">종목</th>
                          <th className="text-center py-3 px-4 font-medium">유형</th>
                          <th className="text-right py-3 px-4 font-medium">주식 수</th>
                          <th className="text-right py-3 px-4 font-medium">가격</th>
                          <th className="text-right py-3 px-4 font-medium">거래 금액</th>
                          <th className="text-right py-3 px-4 font-medium">수수료</th>
                          <th className="text-right py-3 px-4 font-medium">총 금액</th>
                          <th className="text-left py-3 px-4 font-medium">메모</th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">
                              {formatDate(transaction.date)}
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {transaction.symbol}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Badge
                                variant={transaction.type === 'buy' ? 'default' : 'destructive'}
                                className="flex items-center gap-1 w-fit mx-auto"
                              >
                                {transaction.type === 'buy' ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {transaction.type === 'buy' ? '매수' : '매도'}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {transaction.shares.toFixed(4)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {formatCurrency(transaction.price, resolveTransactionCurrency(transaction))}
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatCurrency(transaction.amount, resolveTransactionCurrency(transaction))}
                            </td>
                            <td className="py-3 px-4 text-right text-muted-foreground">
                              {formatCurrency(transaction.fee, resolveTransactionCurrency(transaction))}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold">
                              {formatCurrency(transaction.totalAmount, resolveTransactionCurrency(transaction))}
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                              {transaction.memo || '-'}
                            </td>
                            <td className="py-3 px-4">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => handleDeleteClick(transaction)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                    <p><strong>날짜:</strong> {formatDate(transactionToDelete.date)}</p>
                    <p><strong>금액:</strong> {formatCurrency(transactionToDelete.totalAmount, resolveTransactionCurrency(transactionToDelete!))}</p>
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

