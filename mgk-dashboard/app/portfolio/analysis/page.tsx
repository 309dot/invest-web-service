"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { RebalancingSimulator } from '@/components/RebalancingSimulator';
import { MultiStockChart } from '@/components/MultiStockChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import type { Position } from '@/types';
import type { PortfolioDiagnosisResult } from '@/lib/services/ai-advisor';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';
import { RiskSection } from '@/components/analysis/RiskSection';
import { AllocationPieChart, type AllocationDatum, DEFAULT_ALLOCATION_COLORS } from '@/components/analysis/AllocationPieChart';
import { TopContributorsChart } from '@/components/analysis/TopContributorsChart';
import { GPTSummaryCard } from '@/components/analysis/GPTSummaryCard';
import { RecommendationList } from '@/components/analysis/RecommendationList';
import type { SupportedCurrency } from '@/lib/currency';
import { PortfolioGuidedTour } from '@/components/PortfolioGuidedTour';
import { LearningProgress } from '@/components/LearningProgress';
import { AlertPreferenceCard } from '@/components/AlertPreferenceCard';

export default function PortfolioAnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { formatAmount } = useCurrency();

  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState<PortfolioDiagnosisResult | null>(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  const portfolioId = deriveDefaultPortfolioId(user?.uid);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchDiagnosis = useCallback(async (uid: string) => {
    setDiagnosisLoading(true);
    setDiagnosisError(null);

    try {
      const response = await fetch('/api/ai/portfolio-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, portfolioId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || payload?.success === false) {
        const message = payload?.error ?? payload?.message ?? 'AI 분석에 실패했습니다.';
        throw new Error(message);
      }

      setDiagnosis(payload?.diagnosis ?? null);
    } catch (err) {
      console.error('Failed to fetch AI diagnosis:', err);
      setDiagnosis(null);
      setDiagnosisError(err instanceof Error ? err.message : 'AI 분석에 실패했습니다.');
    } finally {
      setDiagnosisLoading(false);
    }
  }, [portfolioId]);

  const fetchAnalysis = useCallback(async (uid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portfolio/analysis?portfolioId=${portfolioId}&userId=${uid}`);
      if (!response.ok) {
        throw new Error('포트폴리오 분석 데이터를 불러오지 못했습니다.');
      }
      const data = await response.json();
      setAnalysis(data.analysis);
      setPositions(data.positions || []);
      fetchDiagnosis(uid);
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [fetchDiagnosis, portfolioId]);

  useEffect(() => {
    if (user) {
      fetchAnalysis(user.uid);
    }
  }, [user, fetchAnalysis]);

  const handleDiagnosisRetry = useCallback(() => {
    if (user) {
      fetchDiagnosis(user.uid);
    }
  }, [user, fetchDiagnosis]);

  const formatBaseAmount = useCallback(
    (value: number) => formatAmount(value, analysis?.baseCurrency ?? 'USD'),
    [analysis?.baseCurrency, formatAmount]
  );

  const sectorData: AllocationDatum[] = useMemo(() => {
    if (!analysis) return [];
    const sectorLabels: Record<string, string> = {
      technology: '기술',
      healthcare: '헬스케어',
      financial: '금융',
      consumer: '소비재',
      industrial: '산업재',
      energy: '에너지',
      materials: '소재',
      utilities: '유틸리티',
      'real-estate': '부동산',
      communication: '커뮤니케이션',
      other: '기타',
    };

    return analysis.sectorAllocation.map((sector) => ({
      id: sector.sector,
      label: sectorLabels[sector.sector] ?? sector.sector,
      value: sector.value,
      percentage: sector.percentage,
      returnRate: sector.returnRate,
    }));
  }, [analysis]);

  const regionData: AllocationDatum[] = useMemo(() => {
    if (!analysis) return [];
    const regionLabels: Record<string, string> = {
      US: '미국',
      KR: '한국',
      GLOBAL: '글로벌',
    };

    return analysis.regionAllocation.map((region) => ({
      id: region.region,
      label: regionLabels[region.region] ?? region.region,
      value: region.value,
      percentage: region.percentage,
      returnRate: region.returnRate,
    }));
  }, [analysis]);

  const currencyBreakdown = useMemo(
    () => {
      if (!analysis) return [] as Array<{
        currency: SupportedCurrency;
        share: number;
        originalValue: number;
        originalInvested: number;
        convertedValue: number;
        convertedInvested: number;
        count: number;
      }>;

      const total = analysis.totalValue;

      return (Object.entries(analysis.currencyTotals) as Array<[
        SupportedCurrency,
        {
          originalValue: number;
          originalInvested: number;
          convertedValue: number;
          convertedInvested: number;
          count: number;
        }
      ]>)
        .filter(([, data]) => data.count > 0)
        .map(([currency, data]) => ({
          currency,
          share: total > 0 ? (data.convertedValue / total) * 100 : 0,
          originalValue: data.originalValue,
          originalInvested: data.originalInvested,
          convertedValue: data.convertedValue,
          convertedInvested: data.convertedInvested,
          count: data.count,
        }));
    },
    [analysis]
  );

  const dailySummary = useMemo(() => {
    if (!analysis) {
      return null;
    }

    const gain = analysis.overallReturnRate;
    const diversification = analysis.diversificationScore;
    const maxDrawdown = analysis.riskMetrics.maxDrawdown;

    let headline: string;
    if (gain >= 5) {
      headline = `포트폴리오가 +${gain.toFixed(1)}% 상승세를 이어가고 있습니다.`;
    } else if (gain >= 0) {
      headline = `수익률이 +${gain.toFixed(1)}%로 안정적으로 유지되고 있습니다.`;
    } else {
      headline = `수익률이 ${gain.toFixed(1)}%로 조정 중이지만 장기 추세는 건재합니다.`;
    }

    let detail: string;
    if (diversification < 50) {
      detail = '자산이 한 섹터에 치우쳐 있어요. ETF나 해외 자산을 1~2개만 추가해도 흔들림이 크게 줄어듭니다.';
    } else if (maxDrawdown <= -30) {
      detail = '최근 최대 손실폭이 커졌습니다. 현금·채권 비중을 5~10% 보강하면 변동성을 완화할 수 있어요.';
    } else {
      detail = '분산과 리스크 모두 건강한 상태입니다. 다음 달에도 리밸런싱만 꾸준히 점검하면 충분합니다.';
    }

    return { headline, detail };
  }, [analysis]);

  const learningPath = useMemo(() => {
    if (!analysis) return [];
    const modules: Array<{ title: string; detail: string; duration: string }> = [];

    if (analysis.diversificationScore < 55) {
      modules.push({
        title: '분산 업그레이드',
        detail: 'ETF와 해외 섹터를 활용해 한 종목 비중을 낮추는 방법',
        duration: '15분',
      });
    }

    if (analysis.riskMetrics.maxDrawdown <= -30) {
      modules.push({
        title: '드로다운 방어 전략',
        detail: '현금·채권·배당주 비중을 활용해 낙폭을 줄이는 법',
        duration: '10분',
      });
    }

    if (analysis.overallReturnRate < 0) {
      modules.push({
        title: '감정 관리 노트',
        detail: '손실 구간에서 체크해야 할 3가지 질문',
        duration: '8분',
      });
    }

    if (modules.length === 0) {
      modules.push({
        title: '정기 리밸런싱 유지',
        detail: '현재 전략을 유지하면서 분기별로 비중만 점검하세요.',
        duration: '5분',
      });
    }

    return modules.slice(0, 3);
  }, [analysis]);

  const earnedBadges = useMemo(() => {
    if (!analysis) return [];
    const badges: Array<{ label: string; description: string }> = [];

    if (analysis.diversificationScore >= 70) {
      badges.push({
        label: '분산 챌린지 클리어',
        description: '자산이 고르게 분산되어 있습니다.',
      });
    }

    if (analysis.overallReturnRate >= 10) {
      badges.push({
        label: '두 자릿수 수익',
        description: '최근 12개월 수익률이 두 자릿수를 돌파했습니다.',
      });
    }

    if (analysis.riskMetrics.volatility <= 15) {
      badges.push({
        label: '안정 추구자',
        description: '변동성을 15% 이하로 관리 중입니다.',
      });
    }

    return badges;
  }, [analysis]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (!analysis || analysis.sectorAllocation.length === 0) {
    return (
      <>
        <Header />
        <div className="min-h-screen p-4 md:p-8">
          <main className="max-w-7xl mx-auto">
            <div className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">분석할 데이터가 없습니다</h2>
              <p className="text-muted-foreground mb-4">종목을 추가하여 포트폴리오 분석을 시작하세요.</p>
              <Button onClick={() => router.push('/')}>대시보드로 이동</Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  const baseCurrency = analysis.baseCurrency ?? 'USD';
  const exchangeRate = analysis.exchangeRate;

  return (
    <>
      <Header />
      <div className="min-h-screen p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
          <PortfolioGuidedTour />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">포트폴리오 분석</h1>
              <p className="text-muted-foreground">섹터/지역 분산도, 리스크 및 AI 전략을 한눈에 확인하세요.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => user && fetchAnalysis(user.uid)}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                데이터 새로고침
              </Button>
            </div>
          </div>

          {dailySummary ? (
            <Card data-tour="headline" className="border-primary/20 bg-primary/5">
              <CardContent className="py-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">오늘의 한 줄 요약</p>
                <p className="mt-2 text-lg font-semibold text-primary">{dailySummary.headline}</p>
                <p className="mt-1 text-sm text-muted-foreground">{dailySummary.detail}</p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>기준 통화 요약</CardTitle>
                <CardDescription>{baseCurrency} 기준 환산 값</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">총 투자금</p>
                  <p className="text-lg font-semibold">
                    {formatAmount(analysis.totalInvested, baseCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가 금액</p>
                  <p className="text-lg font-semibold">
                    {formatAmount(analysis.totalValue, baseCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 수익률</p>
                  <p className={`text-lg font-semibold ${analysis.overallReturnRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {analysis.overallReturnRate.toFixed(2)}%
                  </p>
                </div>
                {exchangeRate?.rate ? (
                  <p className="text-xs text-muted-foreground">
                    환율 (USD→KRW): {exchangeRate.rate.toFixed(2)} ({exchangeRate.source})
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {currencyBreakdown.map((item) => {
              const currencyLabel = item.currency === 'USD' ? '해외 자산' : '국내 자산';
              return (
                <Card key={item.currency}>
                  <CardHeader>
                    <CardTitle>{currencyLabel}</CardTitle>
                    <CardDescription>
                      {item.count}개 종목 · 포트폴리오 비중 {item.share.toFixed(1)}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">평가 금액 (원 화폐)</p>
                      <p className="font-semibold">
                        {formatAmount(item.originalValue, item.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">투자 금액 (원 화폐)</p>
                      <p className="font-semibold">
                        {formatAmount(item.originalInvested, item.currency)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      기준 환산: {formatAmount(item.convertedValue, baseCurrency)} ({baseCurrency})
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div data-tour="risk-cards">
            <RiskSection
              diversificationScore={analysis.diversificationScore}
              riskMetrics={analysis.riskMetrics}
              overallReturnRate={analysis.overallReturnRate}
            />
          </div>

          <div data-tour="ai-summary">
            <GPTSummaryCard
              diagnosis={diagnosis}
              loading={diagnosisLoading}
              error={diagnosisError}
              onRetry={handleDiagnosisRetry}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <AllocationPieChart
              title="섹터별 분산도"
              description={`${sectorData.length}개 섹터`}
              data={sectorData}
              valueFormatter={formatBaseAmount}
              colors={DEFAULT_ALLOCATION_COLORS}
            />
            <AllocationPieChart
              title="지역별 분산도"
              description={`${regionData.length}개 지역`}
              data={regionData}
              valueFormatter={formatBaseAmount}
              colors={DEFAULT_ALLOCATION_COLORS}
            />
          </div>

          <LearningProgress />
          <AlertPreferenceCard />
          {learningPath.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>맞춤 학습 경로</CardTitle>
                <CardDescription>이번 주에 집중하면 좋은 학습 주제입니다.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {learningPath.map((module) => (
                  <div key={module.title} className="rounded-md border p-3 text-sm">
                    <p className="font-semibold text-primary">{module.title}</p>
                    <p className="mt-1 text-muted-foreground">{module.detail}</p>
                    <p className="mt-2 text-xs text-muted-foreground">소요 시간 · {module.duration}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {earnedBadges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>획득한 배지</CardTitle>
                <CardDescription>투자 습관을 꾸준히 이어온 흔적입니다.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {earnedBadges.map((badge) => (
                  <div key={badge.label} className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary">
                    {badge.label}
                    <span className="ml-2 text-[11px] text-muted-foreground">{badge.description}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>학습 자료</CardTitle>
              <CardDescription>추천 콘텐츠로 투자 감각을 점검해보세요.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {[
                {
                  title: '분산투자 가이드',
                  description: 'ETF로 간단히 시작하는 글로벌 분산 전략',
                  link: 'https://www.investopedia.com/articles/basics/06/diversification.asp',
                },
                {
                  title: '리밸런싱 체크리스트',
                  description: '분할 매매, 현금흐름, 세금 이슈 정리',
                  link: 'https://m.blog.naver.com/PostView.naver?blogId=naverfinance&logNo=222701448177',
                },
                {
                  title: '감정 관리하기',
                  description: '손실 회피 심리를 다루는 5가지 방법',
                  link: 'https://www.morningstar.com/articles/1052663/how-to-deal-with-loss-aversion',
                },
              ].map((resource) => (
                <a
                  key={resource.title}
                  href={resource.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border p-3 transition hover:border-primary/50 hover:bg-muted/50"
                >
                  <p className="text-sm font-semibold text-primary">{resource.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{resource.description}</p>
                </a>
              ))}
            </CardContent>
          </Card>

          <TopContributorsChart data={analysis.topContributors} valueFormatter={formatBaseAmount} />

          {positions.length > 0 && <MultiStockChart positions={positions} />}

          <div data-tour="action-panel" className="space-y-6">
            {positions.length > 0 && (
              <RebalancingSimulator
                positions={positions}
                totalValue={analysis.totalValue}
                baseCurrency={analysis.baseCurrency}
                exchangeRate={analysis.exchangeRate?.rate ?? null}
              />
            )}

            <RecommendationList suggestions={analysis.rebalancingSuggestions} />
          </div>
        </main>
      </div>
    </>
  );
}

