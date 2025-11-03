"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Calendar, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPercent, formatDate } from '@/lib/utils/formatters';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import type { WeeklyReportWithAI } from '@/types';

interface TimelineItem {
  id: string;
  week: string;
  period: string;
  weeklyReturn: number;
  volatility: number;
  generatedAt: string;
  aiAdvice?: WeeklyReportWithAI['aiAdvice'];
}

type LoadingState = 'idle' | 'loading' | 'error';

export default function WeeklyReportsPage() {
  const { formatAmount } = useCurrency();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<TimelineItem | null>(null);
  const [loading, setLoading] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading('loading');
      setError(null);

      try {
        const response = await fetch('/api/weekly-reports');
        if (!response.ok) {
          throw new Error('주간 리포트를 불러오지 못했습니다.');
        }

        const json = await response.json();
        const items: TimelineItem[] = (json.data ?? []).map((item: any) => ({
          id: item.id,
          week: item.week,
          period: item.period,
          weeklyReturn: item.weeklyReturn,
          volatility: item.volatility,
          generatedAt: item.generatedAt,
          aiAdvice: item.aiAdvice,
        }));

        setTimeline(items);
        setSelectedReport(items[0] ?? null);
        setLoading('idle');
      } catch (err) {
        console.error('Weekly report fetch error:', err);
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setLoading('error');
      }
    };

    fetchReports();
  }, []);

  const handleSelect = (id: string) => {
    const report = timeline.find(item => item.id === id);
    if (report) {
      setSelectedReport(report);
    }
  };

  const selectedIndex = selectedReport ? timeline.findIndex(item => item.id === selectedReport.id) : -1;
  const prevReport = selectedIndex > 0 ? timeline[selectedIndex - 1] : null;
  const nextReport = selectedIndex >= 0 && selectedIndex < timeline.length - 1 ? timeline[selectedIndex + 1] : null;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">주간 리포트</h1>
            <p className="text-muted-foreground">투자 성과 요약과 AI 인사이트를 주차별로 확인할 수 있습니다.</p>
          </div>
        </div>

        {loading === 'loading' ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-md border bg-muted/30">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">주간 리포트를 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : timeline.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed bg-muted/30">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">아직 생성된 주간 리포트가 없습니다. 데이터를 수집한 뒤 리포트를 생성하세요.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">AI 인사이트 타임라인</CardTitle>
                <CardDescription>최근 10주 리포트를 확인할 수 있습니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 overflow-y-auto max-h-[540px] pr-2">
                {timeline.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full rounded-md border p-3 text-left transition hover:border-primary/60 hover:bg-primary/5 ${
                      selectedReport?.id === item.id ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{item.week}</p>
                      <Badge variant={item.weeklyReturn >= 0 ? 'default' : 'destructive'} className="text-xs">
                        {formatPercent(item.weeklyReturn)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.period}</p>
                    {item.aiAdvice ? (
                      (() => {
                        const topRecommendation = item.aiAdvice.recommendations?.[0];
                        if (!topRecommendation) {
                          return <p className="mt-2 text-xs text-muted-foreground">AI 권장 없음</p>;
                        }

                        const actionLabel = topRecommendation.action === 'buy'
                          ? '매수'
                          : topRecommendation.action === 'sell'
                          ? '매도'
                          : '유지';

                        return (
                          <p className="mt-2 text-xs text-primary/80">
                            AI 권장: {topRecommendation.ticker} {actionLabel} - {topRecommendation.reason}
                          </p>
                        );
                      })()
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">AI 권장 없음</p>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedReport ? (
              <Card className="border-primary/20">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-2xl">{selectedReport.week}</CardTitle>
                      <CardDescription>{selectedReport.period}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {prevReport ? (
                        <Button variant="outline" size="sm" onClick={() => handleSelect(prevReport.id)}>
                          <ArrowLeft className="mr-2 h-4 w-4" /> 이전 주
                        </Button>
                      ) : null}
                      {nextReport ? (
                        <Button variant="outline" size="sm" onClick={() => handleSelect(nextReport.id)}>
                          다음 주 <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard title="주간 수익률" value={formatPercent(selectedReport.weeklyReturn)} trend={selectedReport.weeklyReturn} />
                    <MetricCard title="변동성" value={`${selectedReport.volatility.toFixed(2)}%`} trend={-selectedReport.volatility} />
                    <MetricCard title="리포트 생성" value={formatDate(selectedReport.generatedAt, 'yyyy-MM-dd HH:mm')} />
                    <MetricCard title="AI 인사이트" value={selectedReport.aiAdvice ? '연동됨' : '없음'} trend={selectedReport.aiAdvice ? 1 : 0} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <section className="space-y-2">
                    <h2 className="text-lg font-semibold">성과 요약</h2>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>항목</TableHead>
                          <TableHead className="text-right">값</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>주간 수익률</TableCell>
                          <TableCell className="text-right">{formatPercent(selectedReport.weeklyReturn)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>변동성</TableCell>
                          <TableCell className="text-right">{selectedReport.volatility.toFixed(2)}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>평균 매수가 (예시)</TableCell>
                          <TableCell className="text-right">{formatAmount(512.45, 'USD')}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>총 평가액 (예시)</TableCell>
                          <TableCell className="text-right">{formatAmount(952.12, 'USD')}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-lg font-semibold">AI 어드바이저 인사이트</h2>
                    {selectedReport.aiAdvice ? (
                      <div className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>생성일: {selectedReport.aiAdvice.generatedAt ? formatDate(selectedReport.aiAdvice.generatedAt.toDate?.() ?? selectedReport.aiAdvice.generatedAt, 'yyyy-MM-dd HH:mm') : '정보 없음'}</span>
                          <div className="flex items-center gap-2">
                            {typeof selectedReport.aiAdvice.confidenceScore === 'number' ? (
                              <Badge variant="outline">신뢰도 {(selectedReport.aiAdvice.confidenceScore * 100).toFixed(0)}%</Badge>
                            ) : null}
                            {typeof selectedReport.aiAdvice.riskScore === 'number' ? (
                              <Badge variant="secondary">위험 지수 {(selectedReport.aiAdvice.riskScore * 100).toFixed(0)}%</Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-3">
                          <section>
                            <h3 className="text-sm font-semibold text-primary">주간 요약</h3>
                            <p className="text-sm text-muted-foreground whitespace-pre-line">
                              {selectedReport.aiAdvice.summary || selectedReport.aiAdvice.weeklySummary}
                            </p>
                          </section>

                          {selectedReport.aiAdvice.newsHighlights?.length ? (
                            <section className="space-y-1">
                              <h3 className="text-sm font-semibold text-primary">핵심 뉴스</h3>
                              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                {selectedReport.aiAdvice.newsHighlights.map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </section>
                          ) : null}

                          {selectedReport.aiAdvice.recommendations?.length ? (
                            <section className="space-y-1">
                              <h3 className="text-sm font-semibold text-primary">권장 전략</h3>
                              <ul className="space-y-2 text-sm text-muted-foreground">
                                {selectedReport.aiAdvice.recommendations.map((item, index) => (
                                  <li key={`${item.ticker}-${index}`} className="rounded-md border border-primary/20 bg-white/60 p-3">
                                    <div className="flex items-center gap-2 text-xs font-semibold">
                                      <Badge variant="secondary" className="uppercase">
                                        {item.ticker}
                                      </Badge>
                                      <Badge
                                        variant={item.action === 'buy' ? 'default' : item.action === 'sell' ? 'destructive' : 'outline'}
                                        className="px-2"
                                      >
                                        {item.action === 'buy' ? '매수' : item.action === 'sell' ? '매도' : '유지'}
                                      </Badge>
                                      <span className="text-muted-foreground">#{index + 1}</span>
                                    </div>
                                    <p className="mt-1 leading-relaxed">{item.reason}</p>
                                    {typeof item.confidence === 'number' ? (
                                      <p className="text-xs text-muted-foreground">신뢰도 {(item.confidence * 100).toFixed(0)}%</p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ) : null}

                          {selectedReport.aiAdvice.signals?.reason ? (
                            <section className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 space-y-1">
                              <p className="font-semibold">위험 신호</p>
                              <p className="leading-relaxed">{selectedReport.aiAdvice.signals.reason}</p>
                              {selectedReport.aiAdvice.signals.notes?.length ? (
                                <ul className="space-y-1 text-xs">
                                  {selectedReport.aiAdvice.signals.notes.map((note, idx) => (
                                    <li key={idx}>- {note}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </section>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed border-primary/20 bg-primary/5 p-6 text-center text-sm text-muted-foreground">
                        해당 주차에는 AI 인사이트가 연결되어 있지 않습니다. 리포트를 재생성하거나 AI 어드바이저를 실행해 보세요.
                      </div>
                    )}
                  </section>
                </CardContent>
                <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
                  <p>AI 인사이트는 참고용입니다. 투자 결정은 투자자 본인의 책임입니다.</p>
                  {selectedReport.aiAdvice?.sourceInsightId ? (
                    <p>Insight ID: {selectedReport.aiAdvice.sourceInsightId}</p>
                  ) : null}
                </CardFooter>
              </Card>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}

function MetricCard({ title, value, trend }: { title: string; value: string; trend?: number }) {
  const trendColor = trend === undefined ? 'text-muted-foreground' : trend >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="rounded-md border border-muted bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className={`text-lg font-semibold ${trendColor}`}>{value}</p>
    </div>
  );
}

