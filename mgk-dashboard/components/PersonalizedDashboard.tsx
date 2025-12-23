"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  GitBranch,
  LayoutGrid,
  Loader2,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import type {
  PersonalizedAction,
  PersonalizedDashboardResponse,
  PersonalizedHeroMetric,
  PersonalizedMetric,
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
import { cn } from '@/lib/utils';
import { formatAmount, formatPercent, getProfitTextClass } from '@/lib/utils/formatters';

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

const GOAL_LABEL: Record<string, string> = {
  growth: '성장 중심',
  income: '현금흐름 강화',
  balanced: '균형 추구',
  'capital-preservation': '자본 보존',
};

type DashboardSectionKey = 'hero' | 'focus' | 'actions' | 'metrics';

const ACTION_SEVERITY_STYLE: Record<PersonalizedAction['severity'], string> = {
  emergency: 'border-red-200/60 bg-red-50/70',
  important: 'border-amber-200/60 bg-amber-50/70',
  info: 'border-primary/15 bg-background/90',
};

const ACTION_BADGE_CLASS: Record<PersonalizedAction['severity'], string> = {
  emergency: 'bg-red-600 hover:bg-red-600 text-white',
  important: 'bg-amber-500 hover:bg-amber-500 text-white',
  info: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10',
};

const ACTION_SOURCE_LABEL: Record<string, string> = {
  alert: '자동 알림',
  ai: 'AI 제안',
  system: '시스템',
  insight: '인사이트',
  widget: '위젯 추천',
};

type FocusAreaKey =
  | 'risk'
  | 'income'
  | 'diversification'
  | 'return'
  | 'growth'
  | 'momentum'
  | 'allocation'
  | 'default';

const FOCUS_AREA_INFO: Record<
  FocusAreaKey,
  {
    title: string;
    description: string;
    tone: string;
    accent: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  risk: {
    title: '리스크 방어',
    description: '손실 폭을 제한하고 변동성을 낮추는 데 집중하세요.',
    tone: 'border-red-200/50 bg-red-50/60 text-red-700',
    accent: 'bg-red-500/80',
    Icon: ShieldCheck,
  },
  income: {
    title: '현금흐름 강화',
    description: '배당/이자 자산 비중과 현금 흐름을 점검하세요.',
    tone: 'border-amber-200/50 bg-amber-50/60 text-amber-700',
    accent: 'bg-amber-500/80',
    Icon: PiggyBank,
  },
  diversification: {
    title: '분산 투자',
    description: '섹터와 지역 노출을 균형 있게 유지하세요.',
    tone: 'border-emerald-200/50 bg-emerald-50/60 text-emerald-700',
    accent: 'bg-emerald-500/80',
    Icon: GitBranch,
  },
  return: {
    title: '수익률 향상',
    description: '성과 기여도가 높은 자산에 비중을 조정하세요.',
    tone: 'border-blue-200/60 bg-blue-50/60 text-blue-700',
    accent: 'bg-blue-500/80',
    Icon: TrendingUp,
  },
  growth: {
    title: '성장 동력',
    description: '성장주와 테마 ETF의 추세를 모니터링하세요.',
    tone: 'border-indigo-200/60 bg-indigo-50/60 text-indigo-700',
    accent: 'bg-indigo-500/80',
    Icon: TrendingUp,
  },
  momentum: {
    title: '모멘텀 추격',
    description: '단기 모멘텀 신호를 살펴 포지션을 조정하세요.',
    tone: 'border-purple-200/60 bg-purple-50/60 text-purple-700',
    accent: 'bg-purple-500/80',
    Icon: Zap,
  },
  allocation: {
    title: '배분 최적화',
    description: '자산군 비중을 목표 범위 내로 리밸런싱하세요.',
    tone: 'border-primary/20 bg-primary/10 text-primary',
    accent: 'bg-primary/70',
    Icon: LayoutGrid,
  },
  default: {
    title: '포커스 영역',
    description: '개인화 설정에 따라 강조 영역을 확인합니다.',
    tone: 'border-muted/50 bg-muted/40 text-muted-foreground',
    accent: 'bg-muted-foreground',
    Icon: Activity,
  },
};

type ProfileLayout = {
  heroAccent: string;
  focusTitle: string;
  focusDescription: string;
  focusTone: string;
  focusCardBase: string;
  quickTips: string[];
  actionTitle: string;
  actionDescription: string;
  actionCardBase: string;
  emptyActionMessage: string;
  sectionOrder: DashboardSectionKey[];
  metricGrid: string;
  widgetBadgeTone: string;
  showFocus: boolean;
};

const PROFILE_LAYOUT: Record<RiskProfile, ProfileLayout> = {
  conservative: {
    heroAccent: 'border-emerald-200/60 backdrop-blur-sm',
    focusTitle: '안정형 포커스',
    focusDescription: '현금흐름과 리스크 방어에 초점을 맞춰 주세요.',
    focusTone: 'border-emerald-200/50 bg-emerald-50/60',
    focusCardBase: 'shadow-sm',
    quickTips: [
      '현금 및 채권 비중을 다시 확인하세요.',
      '자동 투자 시 잔액 경고를 수시로 점검하세요.',
    ],
    actionTitle: '리스크 관리 실행 항목',
    actionDescription: '알림 및 AI 권장 사항 중 위험 완화에 도움이 되는 항목을 먼저 처리하세요.',
    actionCardBase: 'border-emerald-200/40',
    emptyActionMessage: '현재 즉시 실행할 위험 관리 항목이 없습니다.',
    sectionOrder: ['hero', 'focus', 'actions', 'metrics'],
    metricGrid: 'md:grid-cols-2 lg:grid-cols-2',
    widgetBadgeTone: 'border-emerald-300 text-emerald-600',
    showFocus: true,
  },
  balanced: {
    heroAccent: 'border-primary/20 backdrop-blur-sm',
    focusTitle: '균형형 포커스',
    focusDescription: '수익과 리스크의 균형을 유지할 체크포인트입니다.',
    focusTone: 'border-primary/20 bg-primary/5',
    focusCardBase: 'shadow-sm',
    quickTips: [
      '정기적인 리밸런싱 주기를 유지하세요.',
      '주요 지표와 분산 점수를 함께 모니터링하세요.',
    ],
    actionTitle: '우선 실행 항목',
    actionDescription: '가장 영향력이 큰 알림과 추천 작업을 선택해 실행하세요.',
    actionCardBase: 'border-primary/20',
    emptyActionMessage: '현재 표시할 우선 실행 항목이 없습니다.',
    sectionOrder: ['hero', 'actions', 'focus', 'metrics'],
    metricGrid: 'md:grid-cols-2 lg:grid-cols-3',
    widgetBadgeTone: 'border-primary/30 text-primary',
    showFocus: true,
  },
  aggressive: {
    heroAccent: 'border-amber-200/60 backdrop-blur-sm',
    focusTitle: '공격형 포커스',
    focusDescription: '성장과 모멘텀을 살리되 리스크를 통제하세요.',
    focusTone: 'border-amber-200/60 bg-amber-50/60',
    focusCardBase: 'shadow-md',
    quickTips: [
      '성과 상위 종목의 비중을 주기적으로 재조정하세요.',
      '손절 라인과 변동성을 함께 체크하세요.',
    ],
    actionTitle: '성장 기회 실행 항목',
    actionDescription: '고수익 기회를 제공하는 알림과 AI 제안을 우선 수행하세요.',
    actionCardBase: 'border-amber-200/50',
    emptyActionMessage: '현재 즉시 실행할 성장 기회가 없습니다.',
    sectionOrder: ['hero', 'actions', 'metrics', 'focus'],
    metricGrid: 'md:grid-cols-2 lg:grid-cols-3',
    widgetBadgeTone: 'border-amber-300 text-amber-600',
    showFocus: true,
  },
};

function formatMetricValue(metric: PersonalizedHeroMetric | PersonalizedMetric, currency: 'USD' | 'KRW') {
  if (metric.type === 'currency') {
    return formatAmount(metric.value, metric.currency ?? currency);
  }
  if (metric.type === 'percent') {
    return formatPercent(metric.value);
  }
  if (metric.type === 'score') {
    return metric.value.toFixed(1);
  }
  return metric.value.toFixed(2);
}

function ActionBadge({ severity }: { severity: PersonalizedAction['severity'] }) {
  const baseClass = ACTION_BADGE_CLASS[severity] ?? ACTION_BADGE_CLASS.info;
  const label =
    severity === 'emergency' ? '긴급' : severity === 'important' ? '중요' : '정보';
  return <Badge className={cn('px-2 py-0.5 text-xs font-semibold', baseClass)}>{label}</Badge>;
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
        setError(null);
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

  const profileLayout = useMemo<ProfileLayout>(() => {
    if (!data) {
      return PROFILE_LAYOUT[riskProfile];
    }
    return PROFILE_LAYOUT[data.settings.riskProfile] ?? PROFILE_LAYOUT.balanced;
  }, [data, riskProfile]);

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
              {data?.settings?.investmentGoal ? (
                <Badge variant="outline" className="text-xs">
                  목표: {GOAL_LABEL[data.settings.investmentGoal] ?? data.settings.investmentGoal}
                </Badge>
              ) : null}
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
            <div className="space-y-6">
              {(() => {
                const focusAreas = data.settings?.focusAreas ?? [];

                const heroSection = (
                  <section
                    className={cn(
                      'rounded-xl border p-6 shadow-sm transition',
                      moodClasses[data.hero.mood].container,
                      profileLayout.heroAccent
                    )}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={moodClasses[data.hero.mood].badge}>
                            {marketLabel[data.marketMode]?.label ?? '시장 모드'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {marketLabel[data.marketMode]?.description ?? '시장 상황을 점검하세요.'}
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
                      {data.hero.metrics.map((metric) => {
                        const changeValue =
                          metric.change === null || metric.change === undefined
                            ? null
                            : metric.change;
                        const changeClass =
                          changeValue === null
                            ? ''
                            : getProfitTextClass(changeValue, {
                                zeroAsNeutral: true,
                              });
                        return (
                          <div key={metric.id} className="rounded-lg bg-background/80 p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide">
                              {metric.label}
                            </p>
                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="text-3xl font-bold">
                                {formatMetricValue(metric, data.baseCurrency)}
                              </span>
                              {changeValue !== null ? (
                                <span className={cn('flex items-center text-xs font-semibold', changeClass)}>
                                  {changeValue >= 0 ? (
                                    <ArrowUpRight className="mr-1 h-3 w-3" />
                                  ) : (
                                    <ArrowDownRight className="mr-1 h-3 w-3" />
                                  )}
                                  {metric.type === 'currency'
                                    ? formatAmount(
                                        Math.abs(changeValue),
                                        metric.currency ?? data.baseCurrency
                                      )
                                    : formatPercent(Math.abs(changeValue))}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );

                const focusSection =
                  profileLayout.showFocus && (focusAreas.length > 0 || profileLayout.quickTips.length) ? (
                    <section className={cn('rounded-xl border p-5 shadow-sm', profileLayout.focusTone)}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-primary">
                            {profileLayout.focusTitle}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {profileLayout.focusDescription}
                          </p>
                        </div>
                        {profileLayout.quickTips.length ? (
                          <ul className="flex flex-col gap-1 text-xs text-muted-foreground md:text-right">
                            {profileLayout.quickTips.map((tip) => (
                              <li key={tip} className="leading-relaxed">
                                • {tip}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      {focusAreas.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {focusAreas.map((area) => {
                            const info =
                              FOCUS_AREA_INFO[(area as FocusAreaKey) ?? 'default'] ??
                              FOCUS_AREA_INFO.default;
                            const Icon = info.Icon;
                            return (
                              <div
                                key={area}
                                className={cn(
                                  'rounded-lg border p-4 transition hover:shadow-md',
                                  profileLayout.focusCardBase,
                                  info.tone
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'flex h-8 w-8 items-center justify-center rounded-full text-white',
                                      info.accent
                                    )}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <p className="text-sm font-semibold">{info.title}</p>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed">{info.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </section>
                  ) : null;

                const actionsSection = (
                  <section className="space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-primary">
                          {profileLayout.actionTitle}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {profileLayout.actionDescription}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {data.recommendedWidgets?.length ? (
                          data.recommendedWidgets.map((widget) => (
                            <Badge
                              key={widget}
                              variant="outline"
                              className={cn('text-[11px] uppercase tracking-wide', profileLayout.widgetBadgeTone)}
                            >
                              #{widget}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-[11px] uppercase">
                            추천 위젯 없음
                          </Badge>
                        )}
                      </div>
                    </div>
                    {actions.length === 0 ? (
                      <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 p-4 text-sm text-muted-foreground">
                        {profileLayout.emptyActionMessage}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {actions.map((action) => (
                          <div
                            key={action.id}
                            className={cn(
                              'flex flex-col gap-2 rounded-md border p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md md:flex-row md:items-center md:justify-between',
                              profileLayout.actionCardBase,
                              ACTION_SEVERITY_STYLE[action.severity]
                            )}
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <ActionBadge severity={action.severity} />
                                <span className="text-sm font-semibold text-foreground">
                                  {action.title}
                                </span>
                                {action.relatedSymbol ? (
                                  <Badge variant="secondary" className="uppercase">
                                    {action.relatedSymbol}
                                  </Badge>
                                ) : null}
                                {action.source ? (
                                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                                    {ACTION_SOURCE_LABEL[action.source] ?? action.source}
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
                );

                const metricsSection = (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary">핵심 지표</h3>
                    <div className={cn('grid gap-3', profileLayout.metricGrid)}>
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
                );

                const sectionsMap: Partial<Record<DashboardSectionKey, JSX.Element | null>> = {
                  hero: heroSection,
                  focus: focusSection,
                  actions: actionsSection,
                  metrics: metricsSection,
                };

                return profileLayout.sectionOrder.map((sectionKey) => {
                  const node = sectionsMap[sectionKey];
                  return node ? <div key={sectionKey}>{node}</div> : null;
                });
              })()}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

