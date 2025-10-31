/**
 * 포트폴리오 개요 컴포넌트
 * 
 * 전체 포트폴리오의 요약 정보 및 종목별 포지션 목록 표시
 */

"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  MoreVertical,
  RefreshCw,
  ArrowUpDown,
  Trash2,
} from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import type { Position } from '@/types';
import { useAuth } from '@/lib/contexts/AuthContext';

interface PortfolioOverviewProps {
  portfolioId: string;
}

export function PortfolioOverview({ portfolioId }: PortfolioOverviewProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [totals, setTotals] = useState({
    totalInvested: 0,
    totalValue: 0,
    returnRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);

  const fetchPositions = async (uid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/positions?portfolioId=${portfolioId}&userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);
        setTotals(data.totals || { totalInvested: 0, totalValue: 0, returnRate: 0 });
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPositions(user.uid);
    }
  }, [user, portfolioId]);

  useEffect(() => {
    if (!authLoading && !user) {
      setPositions([]);
      setTotals({ totalInvested: 0, totalValue: 0, returnRate: 0 });
      setLoading(false);
    }
  }, [authLoading, user]);

  if (authLoading || !user) {
    return null;
  }

  const handleAddStock = () => {
    router.push(`/portfolio/add-stock?portfolioId=${portfolioId}`);
  };

  const handleTransactionClick = (position: Position) => {
    setSelectedPosition(position);
    setShowTransactionForm(true);
  };

  const handleDeletePosition = async (positionId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 상세 페이지로 이동 방지
    
    if (!confirm('정말로 이 포지션을 삭제하시겠습니까? 모든 거래 내역이 함께 삭제됩니다.')) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch(`/api/positions/${positionId}?userId=${user.uid}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const result = await response.json().catch(() => null);
        const deletedTransactions = result?.deletedTransactions ?? 0;
        await fetchPositions(user.uid); // 목록 새로고침

        if (deletedTransactions > 0) {
          alert(`포지션과 함께 ${deletedTransactions}건의 거래가 삭제되었습니다.`);
        }
      } else {
        const errorBody = await response.json().catch(() => null);
        alert(errorBody?.error || '포지션 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      alert('포지션 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleTransactionSuccess = () => {
    if (user) {
      fetchPositions(user.uid);
    }
    setSelectedPosition(null);
  };

  const profitLoss = totals.totalValue - totals.totalInvested;
  const isPositive = profitLoss >= 0;

  const resolveCurrency = (position: Position): 'USD' | 'KRW' => {
    if (position.currency === 'KRW' || position.currency === 'USD') {
      return position.currency;
    }
    return position.market === 'KR' ? 'KRW' : 'USD';
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
        <p>로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* 포트폴리오 요약 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>포트폴리오 현황</CardTitle>
                <CardDescription>전체 포지션 요약</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => user && fetchPositions(user.uid)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
                <Button onClick={handleAddStock}>
                  <Plus className="mr-2 h-4 w-4" />
                  종목 추가
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>총 투자금</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(totals.totalInvested, 'USD')}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <PieChart className="h-4 w-4" />
                  <span>평가 금액</span>
                </div>
                <p className="text-2xl font-bold">
                  {formatCurrency(totals.totalValue, 'USD')}
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span>총 수익률</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={`text-2xl font-bold ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(totals.returnRate)}
                  </p>
                  <span className={`text-sm ${
                    isPositive ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({isPositive ? '+' : ''}{formatCurrency(profitLoss, 'USD')})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 포지션 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>보유 종목</CardTitle>
            <CardDescription>
              {positions.length}개 종목
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                로딩 중...
              </div>
            ) : positions.length === 0 ? (
              <div className="py-12 text-center">
                <PieChart className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">보유 종목이 없습니다</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  종목을 추가하여 포트폴리오를 시작하세요.
                </p>
                <Button onClick={handleAddStock}>
                  <Plus className="mr-2 h-4 w-4" />
                  첫 종목 추가하기
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 모바일: 카드 형태 */}
                <div className="md:hidden space-y-3">
                  {positions.map((position) => (
                    <Card key={position.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div 
                            className="cursor-pointer hover:opacity-75"
                            onClick={() => router.push(`/portfolio/position/${position.id}`)}
                          >
                            <h4 className="font-semibold text-lg">{position.symbol}</h4>
                            <Badge variant="outline" className="text-xs">
                              {position.purchaseMethod === 'auto' ? '자동투자' : '일괄투자'}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleTransactionClick(position)}>
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                거래 추가
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={(e) => handleDeletePosition(position.id!, e)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                포지션 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">보유 수량</p>
                            <p className="font-medium">{position.shares.toFixed(4)} 주</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">평균 단가</p>
                            <p className="font-medium">{formatCurrency(position.averagePrice, resolveCurrency(position))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">투자 금액</p>
                            <p className="font-medium">{formatCurrency(position.totalInvested, resolveCurrency(position))}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">평가 금액</p>
                            <p className="font-medium">{formatCurrency(position.totalValue, resolveCurrency(position))}</p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">수익률</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${
                                position.returnRate >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {formatPercent(position.returnRate)}
                              </span>
                              <span className={`text-xs ${
                                position.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({position.profitLoss >= 0 ? '+' : ''}{formatCurrency(position.profitLoss, resolveCurrency(position))})
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* 데스크톱: 테이블 형태 */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">종목</th>
                        <th className="text-right py-3 px-4 font-medium">보유 수량</th>
                        <th className="text-right py-3 px-4 font-medium">평균 단가</th>
                        <th className="text-right py-3 px-4 font-medium">투자 금액</th>
                        <th className="text-right py-3 px-4 font-medium">평가 금액</th>
                        <th className="text-right py-3 px-4 font-medium">수익률</th>
                        <th className="text-right py-3 px-4 font-medium">손익</th>
                        <th className="text-center py-3 px-4 font-medium">구매방식</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => (
                        <tr 
                          key={position.id} 
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => router.push(`/portfolio/position/${position.id}`)}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold">{position.symbol}</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {position.shares.toFixed(4)} 주
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(position.averagePrice, resolveCurrency(position))}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(position.totalInvested, resolveCurrency(position))}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {formatCurrency(position.totalValue, resolveCurrency(position))}
                          </td>
                          <td className={`py-3 px-4 text-right font-semibold ${
                            position.returnRate >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatPercent(position.returnRate)}
                          </td>
                          <td className={`py-3 px-4 text-right ${
                            position.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {position.profitLoss >= 0 ? '+' : ''}
                            {formatCurrency(position.profitLoss, resolveCurrency(position))}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant="outline" className="text-xs">
                              {position.purchaseMethod === 'auto' ? '자동' : '일괄'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleTransactionClick(position)}>
                                  <ArrowUpDown className="mr-2 h-4 w-4" />
                                  거래 추가
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={(e) => handleDeletePosition(position.id!, e)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  포지션 삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 거래 입력 폼 */}
      {selectedPosition && (
        <TransactionForm
          open={showTransactionForm}
          onOpenChange={setShowTransactionForm}
          position={selectedPosition}
          portfolioId={portfolioId}
          onSuccess={handleTransactionSuccess}
        />
      )}
    </>
  );
}

