"use client";

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Loader2,
  TrendingUp,
  TrendingDown,
  Newspaper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPercent, formatDate } from '@/lib/utils/formatters';

interface WeeklyReportPreview {
  id?: string;
  week: string;
  period: string;
  weeklyReturn: number;
  volatility: number;
  generatedAt?: string;
  aiAdvice?: {
    weeklySummary?: string;
    newsHighlights?: string[];
    recommendations?: {
      ticker: string;
      action: 'buy' | 'sell' | 'hold';
      reason: string;
      confidence?: number;
    }[];
  } | null;
}

interface WeeklyReportModalProps {
  triggerLabel?: string;
}

export function WeeklyReportModal({ triggerLabel = '주간 리포트 요약' }: WeeklyReportModalProps) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<WeeklyReportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/weekly-reports');
      if (!response.ok) {
        throw new Error('주간 리포트를 불러오지 못했습니다.');
      }

      const payload = await response.json().catch(() => null);
      const latest = Array.isArray(payload?.data) ? payload!.data[0] : null;
      if (!latest) {
        setReport(null);
        return;
      }

      setReport({
        id: latest.id,
        week: latest.week,
        period: latest.period,
        weeklyReturn: latest.weeklyReturn,
        volatility: latest.volatility,
        generatedAt: latest.generatedAt,
        aiAdvice: latest.aiAdvice ?? null,
      });
    } catch (err) {
      console.error('Failed to load weekly report modal:', err);
      setError(err instanceof Error ? err.message : '주간 리포트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (value && !report && !loading && !error) {
      fetchLatestReport();
    }
  };

  const recommendations = report?.aiAdvice?.recommendations?.slice(0, 3) ?? [];
  const newsHighlights = report?.aiAdvice?.newsHighlights?.slice(0, 2) ?? [];
  const summaryText =
    report?.aiAdvice?.weeklySummary ||
    '생성된 요약이 없습니다. 전체 리포트 페이지에서 자세한 내용을 확인하세요.';

  const metricBadge =
    report && report.weeklyReturn >= 0 ? (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
        <TrendingUp className="mr-1 h-3 w-3" /> 상승
      </Badge>
    ) : report ? (
      <Badge variant="destructive">
        <TrendingDown className="mr-1 h-3 w-3" /> 하락
      </Badge>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="inline-flex items-center gap-2 text-primary">
          <Calendar className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            주간 리포트 요약
          </DialogTitle>
          <DialogDescription>최근 발행된 리포트에서 핵심만 빠르게 확인하세요.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">최신 리포트를 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : !report ? (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            아직 생성된 주간 리포트가 없습니다. 데이터를 쌓은 뒤 리포트를 생성해 주세요.
          </div>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{report.period}</p>
                  <p className="text-xl font-semibold">{report.week}</p>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {metricBadge}
                  <span>{formatPercent(report.weeklyReturn)}</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="주간 수익률" value={formatPercent(report.weeklyReturn)} emphasize />
                <Metric label="변동성" value={`${report.volatility.toFixed(2)}%`} />
                <Metric
                  label="리포트 생성"
                  value={report.generatedAt ? formatDate(report.generatedAt, 'yyyy-MM-dd HH:mm') : '-'}
                />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-primary">AI 요약</h3>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{summaryText}</p>
            </section>

            <Separator />

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Top 3 종목 액션</h3>
                <Badge variant="outline">{recommendations.length}건</Badge>
              </div>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground">추천된 종목 액션이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {recommendations.map((item, index) => (
                    <div
                      key={`${item.ticker}-${index}`}
                      className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm"
                    >
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide">
                        <Badge variant="secondary">{item.ticker}</Badge>
                        <Badge
                          variant={
                            item.action === 'buy'
                              ? 'default'
                              : item.action === 'sell'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {item.action === 'buy' ? '매수' : item.action === 'sell' ? '매도' : '유지'}
                        </Badge>
                        {typeof item.confidence === 'number' ? (
                          <span className="text-muted-foreground">{(item.confidence * 100).toFixed(0)}%</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-muted-foreground">{item.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {newsHighlights.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">핵심 뉴스</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {newsHighlights.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-muted/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              <span>더 자세한 주차별 히스토리가 필요하신가요?</span>
              <Button asChild variant="outline" size="xs">
                <Link href="/weekly-reports" className="inline-flex items-center gap-1">
                  전체 리포트 보기
                </Link>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-md border border-muted/60 bg-background/60 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${emphasize ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}


