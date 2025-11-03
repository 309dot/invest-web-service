"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';

interface RecommendationListProps {
  suggestions: PortfolioAnalysis['rebalancingSuggestions'];
  valueFormatter: (value: number) => string;
}

export function RecommendationList({ suggestions, valueFormatter }: RecommendationListProps) {
  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>자동 리밸런싱 제안</CardTitle>
        <CardDescription>균등 비중 기준 자동 제안</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.symbol} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold">{suggestion.symbol}</span>
                  <Badge variant={suggestion.action === 'buy' ? 'default' : suggestion.action === 'sell' ? 'destructive' : 'outline'}>
                    {suggestion.action === 'buy' ? '매수' : suggestion.action === 'sell' ? '매도' : '유지'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
              </div>
              <div className="text-right text-sm">
                <div className="text-muted-foreground">
                  현재 {suggestion.currentWeight.toFixed(1)}% → 목표 {suggestion.targetWeight.toFixed(1)}%
                </div>
                {typeof suggestion.amount === 'number' ? (
                  <div className="font-semibold">{valueFormatter(suggestion.amount)}</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

