"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { PortfolioDiagnosisResult } from '@/lib/services/ai-advisor';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface GPTSummaryCardProps {
  diagnosis: PortfolioDiagnosisResult | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function GPTSummaryCard({ diagnosis, loading, error, onRetry }: GPTSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>AI 종합 진단</CardTitle>
          <CardDescription>포트폴리오 매니저 관점에서 본 요약 및 전략</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 분석 중...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" /> AI 분석 다시 생성
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !diagnosis ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">AI 분석을 생성하는 중입니다...</p>
          </div>
        ) : null}

        {!loading && !error && diagnosis ? (
          <div className="space-y-6">
            <section className="space-y-3 rounded-md border border-primary/20 bg-primary/5 p-4">
              <h3 className="text-sm font-semibold text-primary">이번 주 이야기</h3>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {diagnosis.diagnosis}
              </p>
              <div className="flex flex-wrap gap-2">
                {diagnosis.strengths?.map((item, index) => (
                  <Badge key={`strength-chip-${index}`} variant="secondary" className="bg-emerald-100 text-emerald-700">
                    👍 {item}
                  </Badge>
                ))}
                {diagnosis.weaknesses?.map((item, index) => (
                  <Badge key={`weakness-chip-${index}`} variant="destructive" className="bg-amber-100 text-amber-800">
                    ⚠️ {item}
                  </Badge>
                ))}
              </div>
            </section>

            {diagnosis.strategies?.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">우선순위 액션 플랜</h3>
                <ol className="space-y-2">
                  {diagnosis.strategies.slice(0, 3).map((item, index) => (
                    <li
                      key={`strategy-${index}`}
                      className="flex items-start gap-3 rounded-md border border-muted-foreground/20 bg-muted/30 p-3 text-sm text-muted-foreground"
                    >
                      <span className="text-primary font-semibold">{index + 1}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {diagnosis.stockEvaluations?.length ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-primary">종목 체크포인트</h3>
                  <Badge variant="secondary">총 {diagnosis.stockEvaluations.length}건</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {diagnosis.stockEvaluations.map((stock, index) => (
                    <div key={`${stock.symbol}-${index}`} className="rounded-md border p-3 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{stock.symbol}</span>
                        <Badge
                          variant={
                            stock.recommendation === 'buy'
                              ? 'default'
                              : stock.recommendation === 'sell'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {stock.recommendation === 'buy' ? '매수' : stock.recommendation === 'sell' ? '매도' : '유지'}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium text-foreground">{stock.evaluation}</p>
                      <p className="mt-1 text-xs">{stock.reason}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {diagnosis.rebalancingSuggestion ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">리밸런싱 제안</h3>
                <p className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground whitespace-pre-line">
                  {diagnosis.rebalancingSuggestion}
                </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        AI 진단은 참고용 의견이며, 투자 결정과 책임은 사용자에게 있습니다.
      </CardFooter>
    </Card>
  );
}

