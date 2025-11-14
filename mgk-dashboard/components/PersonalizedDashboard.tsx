"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, Sparkles } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type {
  PersonalizedAction,
  PersonalizedDashboardResponse,
  PersonalizedMetric,
  PersonalizedHeroMetric,
  RiskProfile,
} from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  StatCard,
  StatCardContent,
  StatCardDescription,
  StatCardHeader,
  StatCardTitle,
  StatCardValue,
} from '@/components/ui/stat-card';
import { formatAmount, formatPercent } from '@/lib/utils/formatters';

type RiskOption = {
  value: RiskProfile;
  label: string;
  description: string;
};

const RISK_OPTIONS: RiskOption[] = [
  {
    value: 'conservative',
    label: '보수적',
    description: '손실 최소화, 안정적 수익 추구',
  },
  {
    value: 'balanced',
    label: '균형형',
    description: '위험과 수익의 균형 유지',
  },
  {
    value: 'aggressive',
    label: '공격적',
    description: '높은 수익 가능성, 높은 변동성 수용',
  },
];

const moodClasses: Record<
  PersonalizedDashboardResponse['hero']['mood'],
  { container: string; badge: string }
> = {
  positive: {
    container:
      'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-200/50',
    badge: 'bg-emerald-600 hover:bg-emerald-600',
  },
  negative: {
    container:
      'bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border-red-200/60',
    badge: 'bg-red-500 hover:bg-red-500',
  },
  neutral: {
    container: 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20',
    badge: 'bg-slate-500 hover:bg-slate-500',
  },
};

const marketLabel: Record<
  PersonalizedDashboardResponse['marketMode'],
  { label: string; description: string }
> = {
  bullish: { label: '강세장 모드', description: '수익 모멘텀을 활용하세요.' },
  bearish: { label: '약세장 모드', description: '리스크 관리가 필요합니다.' },
  neutral: { label: '중립 모드', description: '시장 변동성에 대비하세요.' },
};

function formatMetricValue(metric: PersonalizedHeroMetric | PersonalizedMetric, currency: 'USD' | 'KRW') {
  if (metric.type === 'currency') {
    return formatAmount(metric.value, metric.currency ?? currency);
  }
  if (metric.type === 'percent') {
    return formatPercent(metric.value);
  }
  return metric.value.toFixed(2);
}

function ActionBadge({ severity }: { severity: PersonalizedAction['severity'] }) {
  if (severity === 'emergency') {
    return <Badge className="bg-red-600 hover:bg-red-600">긴급</Badge>;
  }
  if (severity === 'important') {
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-white">중요</Badge>;
  }
  return <Badge variant="outline">정보</Badge>;
}

export function PersonalizedDashboard({ portfolioId }: { portfolioId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<PersonalizedDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.uid) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/dashboard/personalized?portfolioId=${portfolioId}&userId=${user.uid}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(`개인화 대시보드 요청 실패 (status: ${response.status})`);
      }
      const payload = (await response.json()) as PersonalizedDashboardResponse;
      setData(payload);
    } catch (err) {
      console.error('[PersonalizedDashboard] 데이터 로딩 실패', err);
      setError(err instanceof Error ? err.message : '개인화 데이터를 불러오지 못했습니다.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [portfolioId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const riskProfile = data?.settings?.riskProfile ?? 'balanced';

  const handleRiskChange = useCallback(
    async (value: RiskProfile) => {
      if (!user?.uid || value === riskProfile) {
        return;
      }
      try {
        setSaving(true);
        const response = await fetch(`/api/settings/personalization?userId=${user.uid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riskProfile: value }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.error || `위험 성향 업데이트 실패 (status: ${response.status})`;
          throw new Error(message);
        }
        await fetchData();
      } catch (err) {
        console.error('[PersonalizedDashboard] 위험 성향 업데이트 실패', err);
        setError(err instanceof Error ? err.message : '위험 성향을 저장하지 못했습니다.');
      } finally {
        setSaving(false);
      }
    },
    [fetchData, riskProfile, user]
  );

  const actions = useMemo(() => data?.actions ?? [], [data]);
  const metrics = useMemo(() => data?.metrics ?? [], [data]);

  if (!user) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-primary" />
              개인화 대시보드
            </CardTitle>
            <CardDescription>
              투자 성향과 시장 상황에 맞춰 핵심 지표와 액션을 요약해 드립니다.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RISK_OPTIONS.map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={riskProfile === option.value ? 'default' : 'outline'}
                onClick={() => handleRiskChange(option.value)}
                disabled={saving}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {RISK_OPTIONS.find((option) => option.value === riskProfile)?.description ??
            '위험과 수익의 균형을 유지합니다.'}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-36 w-full" />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : data ? (
          <>
            <section
              className={`rounded-xl border p-6 shadow-sm transition ${moodClasses[data.hero.mood].container}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={moodClasses[data.hero.mood].badge}>
                      {marketLabel[data.marketMode].label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {marketLabel[data.marketMode].description}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-primary">{data.hero.headline}</h3>
                  <p className="text-sm text-muted-foreground">{data.hero.subheading}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  <span>마지막 업데이트: {new Date(data.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {data.hero.metrics.map((metric) => (
                  <div key={metric.id} className="rounded-lg bg-background/80 p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {metric.label}
                    </p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {formatMetricValue(metric, data.baseCurrency)}
                      </span>
                      {metric.change !== null && metric.change !== undefined ? (
                        <span
                          className={`flex items-center text-xs ${
                            metric.change >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {metric.change >= 0 ? <ArrowUpRight className="mr-1 h-3 w-3" /> : <ArrowDownRight className="mr-1 h-3 w-3" />}
                          {metric.type === 'currency'
                            ? formatAmount(Math.abs(metric.change), metric.currency ?? data.baseCurrency)
                            : formatPercent(Math.abs(metric.change))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">우선 실행 항목</h3>
                <Badge variant="outline" className="border-primary/30 text-xs">
                  추천 위젯: {data.recommendedWidgets.join(', ')}
                </Badge>
              </div>
              {actions.length === 0 ? (
                <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
                  현재 즉시 실행할 항목이 없습니다. 포트폴리오를 계속 모니터링하세요.
                </div>
              ) : (
                <div className="space-y-3">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex flex-col gap-2 rounded-md border border-primary/10 bg-background/80 p-4 shadow-sm md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <ActionBadge severity={action.severity} />
                          <span className="text-sm font-semibold text-foreground">{action.title}</span>
                          {action.relatedSymbol ? (
                            <Badge variant="secondary" className="uppercase">
                              {action.relatedSymbol}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{action.summary}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">핵심 지표</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {metrics.map((metric) => (
                  <StatCard key={metric.id} variant="neutral">
                    <StatCardHeader>
                      <StatCardTitle>{metric.label}</StatCardTitle>
                      <StatCardValue>
                        {formatMetricValue(metric, data.baseCurrency)}
                      </StatCardValue>
                    </StatCardHeader>
                    {metric.description ? (
                      <StatCardContent>
                        <StatCardDescription>{metric.description}</StatCardDescription>
                      </StatCardContent>
                    ) : null}
                  </StatCard>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

