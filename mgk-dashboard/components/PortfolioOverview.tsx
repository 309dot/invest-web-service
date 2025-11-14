/**
 * 포트폴리오 개요 컴포넌트
 * 
 * 전체 포트폴리오의 요약 정보 및 종목별 포지션 목록 표시
 */

"use client";

import { useState, useEffect, useCallback } from 'react';
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
  PieChart,
  MoreVertical,
  RefreshCw,
  ArrowUpDown,
  Trash2,
  Edit2,
} from 'lucide-react';
import { TransactionForm } from './TransactionForm';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import type { Position } from '@/types';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useCurrency } from '@/lib/contexts/CurrencyContext';

interface PortfolioOverviewProps {
  portfolioId: string;
}

type PortfolioTotals = {
  byCurrency: {
    USD: { totalInvested: number; totalValue: number; count: number };
    KRW: { totalInvested: number; totalValue: number; count: number };
  };
  combined: {
    baseCurrency: 'USD' | 'KRW';
    totalInvested: number;
    totalValue: number;
    returnRate: number;
  };
  converted: {
    USD: { totalInvested: number; totalValue: number };
    KRW: { totalInvested: number; totalValue: number };
  };
  exchangeRate?: {
    base: 'USD';
    quote: 'KRW';
    rate: number;
    source: 'live' | 'cache' | 'fallback';
  };
};

const createInitialTotals = (): PortfolioTotals => ({
  byCurrency: {
    USD: { totalInvested: 0, totalValue: 0, count: 0 },
    KRW: { totalInvested: 0, totalValue: 0, count: 0 },
  },
  combined: {
    baseCurrency: 'USD',
    totalInvested: 0,
    totalValue: 0,
    returnRate: 0,
  },
  converted: {
    USD: { totalInvested: 0, totalValue: 0 },
    KRW: { totalInvested: 0, totalValue: 0 },
  },
  exchangeRate: undefined,
});

export function PortfolioOverview({ portfolioId }: PortfolioOverviewProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { exchangeRate } = useCurrency();
  const [positions, setPositions] = useState<Position[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals>(() => createInitialTotals());
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [viewCurrency, setViewCurrency] = useState<'KRW' | 'USD'>('KRW');

  const fetchPositions = useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/positions?portfolioId=${portfolioId}&userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        setPositions(data.positions || []);

        const responseTotals: PortfolioTotals = {
          byCurrency: {
            USD: {
              totalInvested: data?.totals?.byCurrency?.USD?.totalInvested ?? 0,
              totalValue: data?.totals?.byCurrency?.USD?.totalValue ?? 0,
              count: data?.totals?.byCurrency?.USD?.count ?? 0,
            },
            KRW: {
              totalInvested: data?.totals?.byCurrency?.KRW?.totalInvested ?? 0,
              totalValue: data?.totals?.byCurrency?.KRW?.totalValue ?? 0,
              count: data?.totals?.byCurrency?.KRW?.count ?? 0,
            },
          },
          combined: {
            baseCurrency: data?.totals?.combined?.baseCurrency ?? 'USD',
            totalInvested: data?.totals?.combined?.totalInvested ?? 0,
            totalValue: data?.totals?.combined?.totalValue ?? 0,
            returnRate: data?.totals?.combined?.returnRate ?? 0,
          },
          converted: {
            USD: {
              totalInvested: data?.totals?.converted?.USD?.totalInvested ?? 0,
              totalValue: data?.totals?.converted?.USD?.totalValue ?? 0,
            },
            KRW: {
              totalInvested: data?.totals?.converted?.KRW?.totalInvested ?? 0,
              totalValue: data?.totals?.converted?.KRW?.totalValue ?? 0,
            },
          },
          exchangeRate: data?.totals?.exchangeRate,
        };

        setTotals(responseTotals);
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    if (user) {
      fetchPositions(user.uid);
    }
  }, [user, fetchPositions]);

  useEffect(() => {
    if (!authLoading && !user) {
      setPositions([]);
      setTotals(createInitialTotals());
      setLoading(false);
    }
  }, [authLoading, user]);

  if (authLoading || !user) {
    return null;
  }

  const handleAddStock = () => {
    router.push(`/portfolio/add-stock?portfolioId=${portfolioId}`);
  };

  const navigateToPosition = (position: Position) => {
    const targetPortfolioId = position.portfolioId || portfolioId;
    router.push(`/portfolio/position/${position.id}?portfolioId=${targetPortfolioId}`);
  };

  const handleTransactionClick = (position: Position) => {
    setSelectedPosition(position);
    setShowTransactionForm(true);
  };

  const fxRate = exchangeRate ?? totals.exchangeRate?.rate ?? null;

  const convertForView = useCallback(
    (value: number, sourceCurrency: 'USD' | 'KRW') => {
      if (viewCurrency === sourceCurrency) {
        return value;
      }

      if (!fxRate || fxRate <= 0) {
        return value;
      }

      return viewCurrency === 'KRW' ? value * fxRate : value / fxRate;
    },
    [viewCurrency, fxRate]
  );

  const aggregatedTotals = viewCurrency === 'KRW' ? totals.converted.KRW : totals.converted.USD;
  const aggregatedInvested = aggregatedTotals?.totalInvested ?? 0;
  const aggregatedValue = aggregatedTotals?.totalValue ?? 0;
  const aggregatedProfit = aggregatedValue - aggregatedInvested;
  const aggregatedReturnRate =
    aggregatedInvested > 0 ? ((aggregatedValue - aggregatedInvested) / aggregatedInvested) * 100 : 0;
  const currencySummaries = [
    {
      label: 'USD 자산',
      totals: totals.byCurrency.USD,
      currency: 'USD' as const,
    },
    {
      label: 'KRW 자산',
      totals: totals.byCurrency.KRW,
      currency: 'KRW' as const,
    },
  ];

  const handleEditPosition = (
    position: Position,
    e?: { stopPropagation?: () => void }
  ) => {
    e?.stopPropagation?.();
    navigateToPosition(position);
  };

  const handleDeletePosition = async (
    position: Position,
    e?: { stopPropagation?: () => void }
  ) => {
    e?.stopPropagation?.(); // 상세 페이지로 이동 방지

    if (!position.id) {
      alert('포지션 정보가 올바르지 않습니다.');
      return;
    }

    if (!confirm(`${position.symbol} 포지션을 삭제하시겠습니까? 모든 거래 내역이 함께 삭제됩니다.`)) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      const response = await fetch(
        `/api/positions/${position.id}?userId=${user.uid}&portfolioId=${position.portfolioId || portfolioId}`,
        {
        method: 'DELETE',
        }
      );

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
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>포트폴리오 현황</CardTitle>
                <CardDescription>기준 통화를 바꿔 전체 자산을 한눈에 확인하세요.</CardDescription>
              </div>
              <div className="inline-flex overflow-hidden rounded-full border border-muted-foreground/30 bg-muted/40">
                {(['KRW', 'USD'] as const).map((currency) => (
                  <button
                    key={currency}
                    onClick={() => setViewCurrency(currency)}
                    className={`px-4 py-1 text-sm font-medium transition ${
                      viewCurrency === currency
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  선택 통화 기준 합산 ({viewCurrency === 'KRW' ? '원화' : '달러'})
                </span>
                <Badge variant="secondary">{viewCurrency}</Badge>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">총 투자금</p>
                  <p className="text-xl font-semibold">{formatCurrency(aggregatedInvested, viewCurrency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가 금액</p>
                  <p className="text-xl font-semibold">{formatCurrency(aggregatedValue, viewCurrency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">손익 / 수익률</p>
                  <p className={`text-xl font-semibold ${aggregatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {aggregatedProfit >= 0 ? '+' : ''}
                    {formatCurrency(Math.abs(aggregatedProfit), viewCurrency)} · {formatPercent(aggregatedReturnRate)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {currencySummaries.map(({ label, totals: currencyTotals, currency }) => {
                const profit = currencyTotals.totalValue - currencyTotals.totalInvested;
                const returnRate =
                  currencyTotals.totalInvested > 0
                    ? ((currencyTotals.totalValue - currencyTotals.totalInvested) / currencyTotals.totalInvested) * 100
                    : 0;
                const isPositive = profit >= 0;
                const formattedProfit = `${profit >= 0 ? '+' : '-'}${formatCurrency(Math.abs(profit), currency)}`;

                return (
                  <div key={currency} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">{label}</span>
                      <Badge variant="outline">{currencyTotals.count} 종목</Badge>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">총 투자금</p>
                        <p className="text-xl font-semibold">{formatCurrency(currencyTotals.totalInvested, currency)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">평가 금액</p>
                        <p className="text-xl font-semibold">{formatCurrency(currencyTotals.totalValue, currency)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">수익률</span>
                        <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercent(returnRate)} ({formattedProfit})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 포지션 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>보유 종목</CardTitle>
                <CardDescription>{positions.length}개 종목</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => user && fetchPositions(user.uid)}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span className="sr-only">새로고침</span>
                </Button>
                <Button onClick={handleAddStock}>
                  <Plus className="mr-2 h-4 w-4" />
                  종목 추가
                </Button>
              </div>
            </div>
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
                            onClick={() => navigateToPosition(position)}
                          >
                            <h4 className="font-semibold text-lg">{position.symbol}</h4>
                            <Badge variant="outline" className="text-xs">
                              {position.purchaseMethod === 'auto' ? '자동투자' : '일괄투자'}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleTransactionClick(position);
                                }}
                              >
                                <ArrowUpDown className="mr-2 h-4 w-4" />
                                거래 추가
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleEditPosition(position, event);
                                }}
                              >
                                <Edit2 className="mr-2 h-4 w-4" />
                                거래 수정
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleDeletePosition(position, event);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                포지션 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {(() => {
                          const positionCurrency = resolveCurrency(position);
                          const evaluatedValue = convertForView(position.totalValue, positionCurrency);
                          const convertedProfit = convertForView(
                            position.profitLoss ?? position.totalValue - position.totalInvested,
                            positionCurrency
                          );
                          const profitLabel = `${convertedProfit >= 0 ? '+' : '-'}${formatCurrency(
                            Math.abs(convertedProfit),
                            viewCurrency
                          )}`;

                          return (
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">보유 수량</span>
                                <span className="font-medium">{position.shares.toFixed(4)} 주</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">평가 금액 ({viewCurrency})</span>
                                <span className="font-semibold">
                                  {formatCurrency(evaluatedValue, viewCurrency)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-t pt-2">
                                <span className="text-muted-foreground">손익 / 수익률</span>
                                <div className="text-right">
                                  <span
                                    className={`font-semibold ${
                                      convertedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}
                                  >
                                    {profitLabel}
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPercent(position.returnRate)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
                        <th className="text-right py-3 px-4 font-medium">
                          평가 금액 ({viewCurrency})
                        </th>
                        <th className="text-right py-3 px-4 font-medium">손익 / 수익률</th>
                        <th className="w-12 text-center font-medium">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((position) => {
                        const positionCurrency = resolveCurrency(position);
                        const evaluatedValue = convertForView(position.totalValue, positionCurrency);
                        const convertedProfit = convertForView(
                          position.profitLoss ?? position.totalValue - position.totalInvested,
                          positionCurrency
                        );
                        const profitLabel = `${convertedProfit >= 0 ? '+' : '-'}${formatCurrency(
                          Math.abs(convertedProfit),
                          viewCurrency
                        )}`;

                        return (
                          <tr
                            key={position.id}
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={() => navigateToPosition(position)}
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold">{position.symbol}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2">
                                {position.name}
                                <Badge variant="outline" className="text-[10px]">
                                  {position.purchaseMethod === 'auto' ? '자동' : '일괄'}
                                </Badge>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {position.shares.toFixed(4)} 주
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {formatCurrency(evaluatedValue, viewCurrency)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div
                                className={`font-semibold ${
                                  convertedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                {profitLabel}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatPercent(position.returnRate)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleTransactionClick(position);
                                    }}
                                  >
                                    <ArrowUpDown className="mr-2 h-4 w-4" />
                                    거래 추가
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleEditPosition(position, event);
                                    }}
                                  >
                                    <Edit2 className="mr-2 h-4 w-4" />
                                    거래 수정
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleDeletePosition(position, event);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    포지션 삭제
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
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

