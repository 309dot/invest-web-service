"use client";

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, History, Loader2, RefreshCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface AIAdvisorData {
  weeklySummary: string;
  newsHighlights: string[];
  recommendations: string[];
  signals: {
    sellSignal?: boolean;
    reason?: string;
    [key: string]: unknown;
  };
  generatedAt?: string;
  rawText?: string;
  confidenceScore?: number;
}

interface AIAdvisorCardProps {
  initialData?: AIAdvisorData | null;
}

export function AIAdvisorCard({ initialData = null }: AIAdvisorCardProps) {
  const [data, setData] = useState<AIAdvisorData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AIAdvisorData[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          periodDays: Number(process.env.NEXT_PUBLIC_AI_ADVISOR_DEFAULT_PERIOD ?? 7),
          store: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.message ?? 'AI 어드바이저 호출에 실패했습니다.');
      }

      const json = await response.json();
      setData(json.data);
      if (json.data?.rawText?.startsWith('Fallback')) {
        setError('외부 AI 서비스에 연결할 수 없어 기본 요약을 제공했습니다. 환경 설정을 확인해주세요.');
      }
      if (json.stored) {
        setHistory(prev => [json.stored, ...prev].slice(0, 5));
      }
    } catch (err) {
      console.error('AI 어드바이저 새로고침 실패:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/ai-advisor/history');
      if (!response.ok) {
        throw new Error('AI 인사이트 목록을 불러오지 못했습니다.');
      }

      const json = await response.json();
      setHistory(json.data ?? []);
      if (!data && json.data?.length) {
        setData(json.data[0]);
      }
    } catch (err) {
      console.error('AI 인사이트 히스토리 로딩 실패:', err);
    }
  }, [data]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleHistory = () => {
    setIsHistoryOpen(prev => !prev);
  };

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <span role="img" aria-hidden>
                💬
              </span>
              AI 어드바이저 (베타)
            </CardTitle>
            <CardDescription>최근 투자 데이터를 바탕으로 AI가 요약과 전략을 제안합니다.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={toggleHistory}>
              <History className="mr-2 h-4 w-4" /> 히스토리
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 새로고침 중...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> 지금 생성
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">AI 인사이트를 생성 중입니다...</p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-primary">주간 요약</h3>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {data.weeklySummary}
              </p>
            </section>

            {data.newsHighlights?.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">핵심 뉴스</h3>
                <ul className="space-y-2">
                  {data.newsHighlights.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground">
                      - {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {data.recommendations?.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-primary">권장 전략</h3>
                <ul className="space-y-2">
                  {data.recommendations.map((item, index) => (
                    <li key={index} className="text-sm">
                      <span className="font-medium text-primary">#{index + 1}</span>{' '}
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {data.signals?.reason ? (
              <section className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                <p className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> 위험 신호
                </p>
                <p className="mt-1 leading-relaxed">{data.signals.reason}</p>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            아직 생성된 AI 분석이 없습니다. 오른쪽 상단의 ‘지금 생성’ 버튼을 눌러보세요.
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground flex flex-col items-start gap-2">
        <p>AI가 제공하는 인사이트는 참고용이며, 투자 결정은 사용자 책임입니다.</p>
        <p>
          GPT-oss API 키가 환경 변수에 설정되어 있어야 인사이트가 생성됩니다. 키가 없으면 생성이 실패합니다.
        </p>
      </CardFooter>
      {isHistoryOpen && history.length > 0 ? (
        <div className="border-t bg-muted/40">
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                <History className="h-4 w-4" /> 최근 AI 인사이트
              </h3>
              <Button variant="ghost" size="icon" onClick={toggleHistory}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {history.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setData(item)}
                  className={`w-full rounded-md border p-3 text-left transition hover:border-primary/60 ${
                    data?.generatedAt === item.generatedAt ? 'border-primary bg-primary/5' : 'border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.weeklySummary.slice(0, 40)}...</p>
                    {item.generatedAt ? (
                      <Badge variant="secondary" className="text-xs">
                        {new Date(item.generatedAt).toLocaleString()}
                      </Badge>
                    ) : null}
                  </div>
                  {item.recommendations?.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      추천: {item.recommendations.slice(0, 2).join(', ')}
                      {item.recommendations.length > 2 ? ' 외' : ''}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

