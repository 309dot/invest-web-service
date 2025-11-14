"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type { PortfolioOptimizerResponse, OptimizerRecommendation } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatAmount, formatPercent } from '@/lib/utils/formatters';

function renderWeightCell(weight?: number) {
  if (weight === undefined) {
    return '-';
  }
  return `${weight.toFixed(2)}%`;
}

interface RecommendationProps {
  recommendation: OptimizerRecommendation;
  baseCurrency: 'USD' | 'KRW';
  currentWeights: Record<string, number>;
}

function RecommendationCard({ recommendation, baseCurrency, currentWeights }: RecommendationProps) {
  return (
    <div className="rounded-lg border border-primary/15 bg-background/70 p-4 space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
            {recommendation.name}
            <Badge variant="outline" className="border-primary/40 text-xs">
              예상 수익 {formatPercent(recommendation.expectedReturn)} · 예상 위험{' '}
              {formatPercent(recommendation.expectedRisk)}
            </Badge>
          </h3>
          <p className="text-sm text-muted-foreground">{recommendation.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {recommendation.rationale.map((item, index) => (
            <Badge key={index} variant="secondary">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(recommendation.targetWeights).map(([symbol, targetWeight]) => (
          <div key={symbol} className="rounded-md border border-primary/10 bg-background/60 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{symbol}</span>
              <Badge variant="outline" className="border-primary/30">
                Δ {(targetWeight - (currentWeights[symbol] ?? 0)).toFixed(2)}%
              </Badge>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-lg font-semibold text-primary">{targetWeight.toFixed(2)}%</span>
              <span className="text-xs text-muted-foreground">
                현재 {renderWeightCell(currentWeights[symbol])}
              </span>
            </div>
          </div>
        ))}
      </div>

      {recommendation.rebalancing.length ? (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            실행 가이드
          </h4>
          <div className="rounded-md border border-primary/10 bg-background/80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                  <TableHead className="text-right">비중 변화</TableHead>
                  <TableHead className="text-right">거래 금액</TableHead>
                  <TableHead>사유</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendation.rebalancing.map((action) => (
                  <TableRow key={`${recommendation.id}-${action.symbol}`}>
                    <TableCell className="font-medium">{action.symbol}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={
                          action.action === 'buy'
                            ? 'bg-emerald-600 hover:bg-emerald-600'
                            : action.action === 'sell'
                            ? 'bg-red-500 hover:bg-red-500'
                            : 'bg-slate-500 hover:bg-slate-500'
                        }
                      >
                        {action.action === 'buy' ? '매수' : action.action === 'sell' ? '매도' : '유지'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right ${
                        action.weightDelta >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {action.weightDelta >= 0 ? '+' : ''}
                      {action.weightDelta.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(action.amountBase, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {action.rationale}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PortfolioOptimizerCard({ portfolioId }: { portfolioId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<PortfolioOptimizerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOptimization = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/portfolio/optimizer?portfolioId=${portfolioId}&userId=${user.uid}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || `최적화 데이터를 불러오지 못했습니다. (status: ${response.status})`;
        throw new Error(message);
      }
      const payload = (await response.json()) as PortfolioOptimizerResponse;
      setData(payload);
    } catch (err) {
      console.error('[PortfolioOptimizerCard] 로딩 실패', err);
      setError(err instanceof Error ? err.message : '포트폴리오 최적화 데이터를 가져오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, user]);

  useEffect(() => {
    fetchOptimization();
  }, [fetchOptimization]);

  const currentWeights = useMemo(() => data?.currentWeights ?? {}, [data]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-primary" />
              포트폴리오 최적화
            </CardTitle>
            <CardDescription>
              현 비중을 분석해 성장형·방어형·다각화 전략별 추천 비중을 제시합니다.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={fetchOptimization} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            새로고침
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : data ? (
          <>
            <section className="rounded-lg border border-primary/10 bg-background/70 p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">현재 비중</h3>
              {Object.keys(currentWeights).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  분석 가능한 포지션이 없습니다. 포지션 데이터를 확인해주세요.
                </p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(currentWeights).map(([symbol, weight]) => (
                    <div
                      key={`current-${symbol}`}
                      className="rounded-md border border-primary/10 bg-background/80 p-3"
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{symbol}</p>
                      <p className="text-lg font-semibold text-primary">{weight.toFixed(2)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {data.recommendations.length === 0 ? (
              <Alert>
                <AlertDescription>
                  추천 가능한 최적화 전략이 없습니다. 포지션 구성을 확인해주세요.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {data.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    baseCurrency={data.baseCurrency}
                    currentWeights={currentWeights}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

