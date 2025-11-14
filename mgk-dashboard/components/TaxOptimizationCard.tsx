"use client";

import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Coins, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type {
  TaxOptimizationConfig,
  TaxOptimizationPosition,
  TaxOptimizationResponse,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  StatCard,
  StatCardContent,
  StatCardDescription,
  StatCardHeader,
  StatCardTitle,
  StatCardValue,
} from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { formatAmount, formatPercent } from '@/lib/utils/formatters';

const ACTION_LABELS: Record<TaxOptimizationPosition['action'], string> = {
  'harvest-loss': '손실 실현',
  'offset-gain': '차익 조절',
  monitor: '모니터링',
};

const ACTION_VARIANTS: Record<TaxOptimizationPosition['action'], string> = {
  'harvest-loss': 'bg-red-500 hover:bg-red-500 text-white',
  'offset-gain': 'bg-amber-500 hover:bg-amber-500 text-white',
  monitor: 'bg-slate-500 hover:bg-slate-500 text-white',
};

export function TaxOptimizationCard({ portfolioId }: { portfolioId: string }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<TaxOptimizationConfig>({
    targetHarvestAmount: 500000,
    estimatedTaxRate: 22,
  });
  const [result, setResult] = useState<TaxOptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runOptimization = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/portfolio/tax-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          portfolioId,
          targetHarvestAmount: Number(config.targetHarvestAmount),
          estimatedTaxRate: Number(config.estimatedTaxRate),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error || `세금 최적화 실패 (status: ${response.status})`;
        throw new Error(message);
      }

      const payload = (await response.json()) as TaxOptimizationResponse;
      setResult(payload);
    } catch (err) {
      console.error('[TaxOptimization] 실행 실패', err);
      setError(err instanceof Error ? err.message : '세금 최적화 계획을 생성하지 못했습니다.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [config, portfolioId, user]);

  const harvestPositions = useMemo(
    () => result?.candidates.filter((item) => item.action === 'harvest-loss') ?? [],
    [result]
  );

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-5 w-5 text-primary" />
              세금 최적화 도구
            </CardTitle>
            <CardDescription>
              손실을 활용한 절세 전략과 과세 대상 포지션을 한눈에 정리합니다.
            </CardDescription>
          </div>
          <Button onClick={runOptimization} disabled={loading} size="sm">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            최적화 계산
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <section>
          <h3 className="text-sm font-semibold text-primary mb-3">목표 설정</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                손실 실현 목표 (KRW)
              </label>
              <Input
                type="number"
                value={config.targetHarvestAmount}
                min={0}
                step={100000}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    targetHarvestAmount: Number(event.target.value),
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                목표 금액만큼 손실을 실현해 과세 대상 수익을 상계합니다.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">
                예상 세율 (%)
              </label>
              <Input
                type="number"
                value={config.estimatedTaxRate}
                min={0}
                max={60}
                step={0.5}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    estimatedTaxRate: Number(event.target.value),
                  }))
                }
              />
              <p className="text-[11px] text-muted-foreground">
                배당·양도소득세율을 반영해 절세 효과를 추정합니다.
              </p>
            </div>
          </div>
        </section>

        {result ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>총 평가 손실</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.summary.totalUnrealizedLoss, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>현재 포트폴리오에서 실현 가능한 손실.</StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>총 평가 이익</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.summary.totalUnrealizedGain, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>과세 대상이 될 잠재 수익.</StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>실현 손실 목표</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.summary.harvestTarget, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    설정한 목표 대비 {formatAmount(result.summary.harvestAchieved, 'KRW')} 확보 가능.
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>

              <StatCard variant="neutral">
                <StatCardHeader>
                  <StatCardTitle>예상 절세 효과</StatCardTitle>
                  <StatCardValue>
                    {formatAmount(result.summary.estimatedTaxSavings, 'KRW')}
                  </StatCardValue>
                </StatCardHeader>
                <StatCardContent>
                  <StatCardDescription>
                    세율 {result.config.estimatedTaxRate.toFixed(1)}% 기준 추정.
                  </StatCardDescription>
                </StatCardContent>
              </StatCard>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">손실 실현 추천 종목</h3>
                <Badge variant="outline" className="border-primary/30 text-xs">
                  추천 {harvestPositions.length}개 · 총{' '}
                  {formatAmount(
                    harvestPositions.reduce((sum, item) => sum + item.harvestAmount, 0),
                    'KRW'
                  )}
                </Badge>
              </div>
              {harvestPositions.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    실현 가능한 평가 손실이 없습니다. 추가 조치가 필요하지 않습니다.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="rounded-lg border border-primary/10 bg-background/80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>종목</TableHead>
                        <TableHead className="text-right">평가 손익</TableHead>
                        <TableHead className="text-right">손실 실현</TableHead>
                        <TableHead className="text-right">수익률</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {harvestPositions.map((position) => (
                        <TableRow key={position.symbol}>
                          <TableCell className="flex items-center gap-2">
                            <Badge className={ACTION_VARIANTS[position.action]}>
                              {ACTION_LABELS[position.action]}
                            </Badge>
                            <span className="font-medium">{position.symbol}</span>
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatAmount(position.profitLoss, 'KRW')}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {formatAmount(position.harvestAmount, 'KRW')}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatPercent(position.returnRate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">전체 포지션 상태</h3>
              <div className="rounded-lg border border-primary/10 bg-background/70">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>종목</TableHead>
                      <TableHead className="text-right">평가 금액</TableHead>
                      <TableHead className="text-right">평가 손익</TableHead>
                      <TableHead className="text-right">수익률</TableHead>
                      <TableHead className="text-right">추천</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.candidates.map((position) => (
                      <TableRow key={`all-${position.symbol}`}>
                        <TableCell className="font-medium">{position.symbol}</TableCell>
                        <TableCell className="text-right">
                          {formatAmount(position.totalValue, 'KRW')}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            position.profitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatAmount(position.profitLoss, 'KRW')}
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            position.returnRate >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {formatPercent(position.returnRate)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={ACTION_VARIANTS[position.action]}>
                            {ACTION_LABELS[position.action]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

