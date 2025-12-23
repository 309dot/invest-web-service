"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { formatAmount, formatPercent, getProfitTextClass } from '@/lib/utils/formatters';
import type {
  ContributionBreakdownEntry,
  ContributionBreakdownResponse,
  StockComparisonPeriod,
} from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PERIOD_OPTIONS: Array<{ id: StockComparisonPeriod; label: string }> = [
  { id: '1m', label: '1개월' },
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
];

const TAG_LABEL: Record<NonNullable<ContributionBreakdownEntry['tag']>, string> = {
  core: '핵심 수익원',
  supporting: '보조 수익원',
  reducing: '비중 축소 후보',
  watch: '관찰 대상',
};

const TAG_STYLE: Record<NonNullable<ContributionBreakdownEntry['tag']>, string> = {
  core: 'bg-emerald-600 hover:bg-emerald-600',
  supporting: 'bg-primary/80 hover:bg-primary',
  reducing: 'bg-destructive hover:bg-destructive',
  watch: 'bg-muted-foreground hover:bg-muted-foreground',
};

const COLOR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#a855f7',
  '#dc2626',
  '#0ea5e9',
  '#facc15',
  '#14b8a6',
  '#f472b6',
  '#fb7185',
];

const TOP_LIMIT = 5;

interface ContributionBreakdownProps {
  portfolioId: string;
}

export function ContributionBreakdown({ portfolioId }: ContributionBreakdownProps) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<StockComparisonPeriod>('3m');
  const [data, setData] = useState<ContributionBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContribution = useCallback(async () => {
    if (!user) {
      return;
    }

    const params = new URLSearchParams({
      portfolioId,
      userId: user.uid,
      period,
    });

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/portfolio/contribution?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`요청 실패 (status: ${response.status}) ${text}`);
      }

      const payload = (await response.json()) as ContributionBreakdownResponse;
      setData(payload);
    } catch (err) {
      console.error('[ContributionBreakdown] 데이터 로딩 실패', err);
      setError(err instanceof Error ? err.message : '기여도 데이터를 불러오지 못했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, portfolioId, user]);

  useEffect(() => {
    fetchContribution();
  }, [fetchContribution]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const total = data?.totals;
  const baseCurrency = data?.baseCurrency ?? 'KRW';

  const colorBySymbol = useMemo(() => {
    const map = new Map<string, string>();
    entries.forEach((entry, index) => {
      map.set(entry.symbol, COLOR_PALETTE[index % COLOR_PALETTE.length] ?? '#2563eb');
    });
    return map;
  }, [entries]);

  const topWeightEntries = useMemo(
    () => entries.slice().sort((a, b) => b.weightPct - a.weightPct).slice(0, TOP_LIMIT),
    [entries]
  );

  const topContributionEntries = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => Math.abs(b.contributionValue) - Math.abs(a.contributionValue))
        .slice(0, TOP_LIMIT),
    [entries]
  );

  const totalPositiveContribution = useMemo(
    () => entries.filter((entry) => entry.contributionValue > 0).reduce((sum, entry) => sum + entry.contributionValue, 0),
    [entries]
  );
  const totalNegativeContribution = useMemo(
    () => entries.filter((entry) => entry.contributionValue < 0).reduce((sum, entry) => sum + entry.contributionValue, 0),
    [entries]
  );

  const topWeightShare = useMemo(
    () => topWeightEntries.reduce((sum, entry) => sum + entry.weightPct, 0),
    [topWeightEntries]
  );

  const topContributionNet = useMemo(
    () => topContributionEntries.reduce((sum, entry) => sum + entry.contributionPct, 0),
    [topContributionEntries]
  );

  const topContributionAbsShare = useMemo(
    () => topContributionEntries.reduce((sum, entry) => sum + Math.abs(entry.contributionPct), 0),
    [topContributionEntries]
  );

  const getSymbolColor = useCallback(
    (symbol: string) => colorBySymbol.get(symbol) ?? '#2563eb',
    [colorBySymbol]
  );

  const formatSignedAmountBase = useCallback(
    (value: number) => {
      const formatted = formatAmount(Math.abs(value), baseCurrency);
      if (Math.abs(value) < 1e-6) {
        return formatted;
      }
      return value >= 0 ? `+${formatted}` : `-${formatted}`;
    },
    [baseCurrency]
  );

  const formatSignedAmountLocal = useCallback((value: number, currency: 'USD' | 'KRW') => {
    const formatted = formatAmount(Math.abs(value), currency);
    if (Math.abs(value) < 1e-6) {
      return formatted;
    }
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  }, []);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base">수익 기여도 분석</CardTitle>
            <CardDescription>
              포트폴리오 내 각 종목의 비중과 수익 기여도를 분리해 살피고, 리밸런싱 우선순위를 판단하세요.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={period === option.id ? 'default' : 'outline'}
                onClick={() => setPeriod(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            기여도 분석에 필요한 데이터가 충분하지 않습니다. 거래 이력을 확인해주세요.
          </div>
        ) : (
          <>
            {total ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border border-primary/10 bg-background/80 p-4">
                  <p className="text-xs text-muted-foreground">총 평가액</p>
                  <p className="text-sm font-semibold text-primary">
                    {formatAmount(total.totalValue, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-md border border-primary/10 bg-background/80 p-4">
                  <p className="text-xs text-muted-foreground">총 투자금</p>
                  <p className="text-sm font-semibold text-primary">
                    {formatAmount(total.totalInvested, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-xs text-muted-foreground">총 기여도 금액</p>
                  <p className="text-sm font-semibold text-emerald-600">
                    {formatAmount(total.totalContributionValue, baseCurrency)}
                  </p>
                </div>
                <div className="rounded-md border border-primary/10 bg-background/80 p-4">
                  <p className="text-xs text-muted-foreground">총 기여도 비중</p>
                  <p className="text-sm font-semibold text-primary">
                    {formatPercent(total.totalContributionPct)}
                  </p>
                </div>
              </div>
            ) : null}

            {entries.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-primary/10 bg-background/80 p-4">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>비중 상위 {topWeightEntries.length}개</span>
                    <span className="text-xs text-muted-foreground">
                      합계 {formatPercent(topWeightShare)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    상위 보유 종목이 포트폴리오 비중의 {formatPercent(topWeightShare)}를 차지합니다.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {topWeightEntries.map((entry) => (
                      <li
                        key={`weight-${entry.symbol}`}
                        className="rounded-sm border border-muted/20 bg-muted/20 p-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getSymbolColor(entry.symbol) }}
                            />
                            <span className="font-semibold text-foreground">{entry.symbol}</span>
                            <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                          </div>
                          <span className="font-semibold">{formatPercent(entry.weightPct)}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                            <div
                              className="absolute left-0 top-0 h-full transition-all"
                              style={{
                                width: `${Math.min(Math.max(entry.weightPct, 0), 100)}%`,
                                backgroundColor: getSymbolColor(entry.symbol),
                              }}
                            />
                          </div>
                          <span className="w-20 text-right text-[11px] text-muted-foreground">
                            {formatAmount(entry.currentValue, entry.currency)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-md border border-primary/10 bg-background/80 p-4">
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>성과 기여 상위 {topContributionEntries.length}개</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>순합 {formatPercent(topContributionNet)}</span>
                      <span className="hidden md:inline-block text-muted-foreground/80">
                        | 절댓값 합 {formatPercent(topContributionAbsShare)}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    수익 기여도가 큰 종목을 따로 분리해 리밸런싱 후보를 빠르게 파악하세요.
                  </p>
                  <ul className="mt-3 space-y-2">
                    {topContributionEntries.map((entry) => (
                      <li
                        key={`contrib-${entry.symbol}`}
                        className="rounded-sm border border-muted/20 bg-muted/20 p-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getSymbolColor(entry.symbol) }}
                            />
                            <span className="font-semibold text-foreground">{entry.symbol}</span>
                            <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                          </div>
                          <span
                            className={cn(
                              'font-semibold',
                              getProfitTextClass(entry.contributionValue, { zeroAsNeutral: true })
                            )}
                          >
                            {formatPercent(entry.contributionPct)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60">
                            <div
                              className={cn(
                                'absolute left-0 top-0 h-full transition-all',
                                entry.contributionValue >= 0 ? 'bg-emerald-500' : 'bg-destructive'
                              )}
                              style={{
                                width: `${Math.min(Math.abs(entry.contributionPct), 100)}%`,
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              'w-24 text-right text-[11px] font-medium',
                              getProfitTextClass(entry.contributionValue, { zeroAsNeutral: true })
                            )}
                          >
                            {formatSignedAmountLocal(entry.contributionValue, entry.currency)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      <span
                        className={cn(
                          'font-semibold',
                          getProfitTextClass(totalPositiveContribution, { zeroAsNeutral: true })
                        )}
                      >
                        {formatSignedAmountBase(totalPositiveContribution)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <ArrowDownRight className="h-3 w-3 text-destructive" />
                      <span
                        className={cn(
                          'font-semibold',
                          getProfitTextClass(totalNegativeContribution, { zeroAsNeutral: true })
                        )}
                      >
                        {formatSignedAmountBase(totalNegativeContribution)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-md border border-primary/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>종목</TableHead>
                    <TableHead className="text-right">포트폴리오 비중</TableHead>
                    <TableHead className="text-right">수익률</TableHead>
                    <TableHead className="text-right">기여도 (금액)</TableHead>
                    <TableHead className="text-right">기여도 (비중)</TableHead>
                    <TableHead className="text-right">비중 대비 기여도</TableHead>
                    <TableHead className="text-right">평가액</TableHead>
                    <TableHead className="text-right">평균 매수</TableHead>
                    <TableHead className="text-right">현재가</TableHead>
                    <TableHead className="text-right">거래 수</TableHead>
                    <TableHead className="text-right">태그</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const deltaPct = entry.contributionPct - entry.weightPct;
                    const DeltaIcon = deltaPct >= 0 ? ArrowUpRight : ArrowDownRight;
                    return (
                      <TableRow key={`contrib-${entry.symbol}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: getSymbolColor(entry.symbol) }}
                            />
                            <span className="font-semibold">{entry.symbol}</span>
                            <span className="text-xs text-muted-foreground">{entry.name}</span>
                            {entry.isTopContributor ? (
                              <Badge variant="outline" className="border-emerald-400 text-emerald-600">
                                Top
                              </Badge>
                            ) : null}
                            {entry.isLagging ? (
                              <Badge variant="outline" className="border-destructive text-destructive">
                                Lagging
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-medium">{formatPercent(entry.weightPct)}</span>
                            <div className="relative h-1.5 w-28 overflow-hidden rounded-full bg-muted/60">
                              <div
                                className="absolute left-0 top-0 h-full"
                                style={{
                                  width: `${Math.min(Math.max(entry.weightPct, 0), 100)}%`,
                                  backgroundColor: getSymbolColor(entry.symbol),
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            getProfitTextClass(entry.returnPct, { zeroAsNeutral: true })
                          )}
                        >
                          {formatPercent(entry.returnPct)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            getProfitTextClass(entry.contributionValue, { zeroAsNeutral: true })
                          )}
                        >
                          {formatSignedAmountLocal(entry.contributionValue, entry.currency)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-medium',
                            getProfitTextClass(entry.contributionValue, { zeroAsNeutral: true })
                          )}
                        >
                          {formatPercent(entry.contributionPct)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'inline-flex items-center justify-end gap-1 font-medium',
                              getProfitTextClass(deltaPct, { zeroAsNeutral: true })
                            )}
                          >
                            <DeltaIcon className="h-3 w-3" />
                            {formatPercent(deltaPct)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(entry.currentValue, entry.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(entry.averagePrice, entry.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatAmount(entry.currentPrice, entry.currency)}
                        </TableCell>
                        <TableCell className="text-right">{entry.transactions}</TableCell>
                        <TableCell className="text-right">
                          {entry.tag ? (
                            <Badge className={`${TAG_STYLE[entry.tag]} text-[10px]`}>
                              {TAG_LABEL[entry.tag]}
                            </Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-md border border-muted-foreground/20 bg-background/80 p-4 text-xs text-muted-foreground">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Info className="h-4 w-4" />
                인사이트 요약
              </p>
              <ul className="mt-2 space-y-1">
                {entries.slice(0, 5).map((entry) => {
                  const deltaPct = entry.contributionPct - entry.weightPct;
                  return (
                    <li key={`insight-${entry.symbol}`} className="leading-relaxed">
                      <span className="font-semibold text-foreground">{entry.name}</span> : 비중{' '}
                      {formatPercent(entry.weightPct)}, 기여도 {formatPercent(entry.contributionPct)} (
                      {formatSignedAmountLocal(entry.contributionValue, entry.currency)}, Δ{' '}
                      {formatPercent(deltaPct)}).{' '}
                      {entry.isTopContributor
                        ? '핵심 수익원으로 비중 유지 또는 확대를 고려해보세요.'
                        : entry.isLagging
                        ? '손실 기여가 크니 리밸런싱 또는 손절 전략을 검토하세요.'
                        : '성과가 안정적인 종목으로 지속 모니터링이 필요합니다.'}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

