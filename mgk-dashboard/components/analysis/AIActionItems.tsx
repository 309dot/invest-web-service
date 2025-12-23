"use client";

import { useMemo } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { PortfolioDiagnosisResult } from '@/lib/services/ai-advisor';
import { cn } from '@/lib/utils';

interface AIActionItemsProps {
  diagnosis: PortfolioDiagnosisResult | null;
  loading?: boolean;
  error?: string | null;
}

type ActionPriority = 'high' | 'medium' | 'low';

interface ActionItem {
  id: string;
  title: string;
  detail: string;
  priority: ActionPriority;
  category: 'rebalance' | 'trade' | 'maintenance' | 'strategy';
  symbol?: string;
  meta?: string;
}

const PRIORITY_LABEL: Record<ActionPriority, string> = {
  high: '우선 실행',
  medium: '조만간',
  low: '관찰 중',
};

const PRIORITY_STYLE: Record<ActionPriority, string> = {
  high: 'bg-rose-100 text-rose-700 border-rose-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function AIActionItems({ diagnosis, loading = false, error = null }: AIActionItemsProps) {
  const actionItems = useMemo(() => {
    if (!diagnosis) {
      return [] as ActionItem[];
    }

    const items: ActionItem[] = [];

    if (diagnosis.rebalancingSuggestion) {
      items.push({
        id: 'rebalance-suggestion',
        title: '리밸런싱 실행',
        detail: diagnosis.rebalancingSuggestion,
        priority: 'medium',
        category: 'rebalance',
      });
    }

    diagnosis.stockEvaluations?.forEach((stock, index) => {
      const priority =
        stock.recommendation === 'sell'
          ? 'high'
          : stock.recommendation === 'buy'
            ? 'medium'
            : 'low';

      if (priority === 'low') {
        return;
      }

      items.push({
        id: `stock-${stock.symbol}-${index}`,
        title:
          stock.recommendation === 'sell'
            ? `${stock.symbol} 비중 축소`
            : `${stock.symbol} 비중 확대`,
        detail: stock.reason || stock.evaluation,
        priority,
        category: 'trade',
        symbol: stock.symbol,
        meta: stock.recommendation === 'sell' ? '매도 권장' : '추가 매수 권장',
      });
    });

    diagnosis.strategies?.forEach((strategy, index) => {
      const normalized = strategy.replace(/^[0-9.\-\s]+/, '').trim();
      items.push({
        id: `strategy-${index}`,
        title: normalized.split(/[.!?]/)[0] ?? normalized,
        detail: normalized,
        priority: index === 0 ? 'high' : 'medium',
        category: 'strategy',
      });
    });

    const weaknessHints =
      diagnosis.weaknesses?.map(
        (weakness, index): ActionItem => ({
          id: `weakness-${index}`,
          title: weakness,
          detail: weakness,
          priority: 'medium',
          category: 'maintenance',
        })
      ) ?? [];

    return [...items, ...weaknessHints].slice(0, 8);
  }, [diagnosis]);

  const prioritySummary = useMemo(() => {
    return actionItems.reduce(
      (acc, item) => {
        acc[item.priority] += 1;
        return acc;
      },
      { high: 0, medium: 0, low: 0 } as Record<ActionPriority, number>
    );
  }, [actionItems]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>AI 실행 우선순위</CardTitle>
          <CardDescription>AI 분석을 바탕으로 지금 바로 실행할 액션을 정리했습니다.</CardDescription>
        </div>
        {diagnosis?.overallScore !== undefined ? (
          <Badge variant="outline" className={cn('text-xs font-medium', getScoreTone(diagnosis.overallScore))}>
            신뢰도 {diagnosis.overallScore}/100
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !diagnosis ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">AI 액션 아이템을 불러오는 중입니다...</p>
          </div>
        ) : null}

        {!loading && diagnosis && actionItems.length === 0 ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <AlertDescription>긴급하게 실행해야 할 항목이 없습니다. 현재 전략을 유지하면서 시장 상황을 관찰하세요.</AlertDescription>
          </Alert>
        ) : null}

        {!loading && actionItems.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200">
                긴급 {prioritySummary.high}건
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                중요 {prioritySummary.medium}건
              </Badge>
              {prioritySummary.low > 0 ? (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                  모니터링 {prioritySummary.low}건
                </Badge>
              ) : null}
            </div>

            <div className="space-y-3">
              {actionItems.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border bg-card/60 p-4 shadow-sm transition hover:border-primary/40 hover:bg-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={cn('border', PRIORITY_STYLE[item.priority])}>{PRIORITY_LABEL[item.priority]}</Badge>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">{formatCategory(item.category)}</span>
                    {item.symbol ? (
                      <Badge variant="outline" className="text-xs font-semibold">
                        {item.symbol}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-start gap-3">
                    <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-semibold leading-tight">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.detail}</p>
                      {item.meta ? (
                        <p className="text-xs text-muted-foreground/80">
                          • 실행 힌트: {item.meta}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {index !== actionItems.length - 1 ? <Separator className="mt-4" /> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatCategory(category: ActionItem['category']): string {
  switch (category) {
    case 'rebalance':
      return '리밸런싱';
    case 'trade':
      return '거래 액션';
    case 'strategy':
      return '전략 실행';
    case 'maintenance':
      return '유지/모니터링';
    default:
      return '기타';
  }
}

function getScoreTone(score: number): string {
  if (score >= 85) {
    return 'bg-emerald-50 text-emerald-600 border-emerald-200';
  }
  if (score >= 60) {
    return 'bg-amber-50 text-amber-600 border-amber-200';
  }
  return 'bg-rose-50 text-rose-600 border-rose-200';
}


