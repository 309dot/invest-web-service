"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';

import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { RebalancingSimulator } from '@/components/RebalancingSimulator';
import { MultiStockChart } from '@/components/MultiStockChart';
import { Button } from '@/components/ui/button';
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

  const formatUsd = useCallback((value: number) => formatAmount(value, 'USD'), [formatAmount]);

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

  return (
    <>
      <Header />
      <div className="min-h-screen p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
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

          <RiskSection
            diversificationScore={analysis.diversificationScore}
            riskMetrics={analysis.riskMetrics}
            overallReturnRate={analysis.overallReturnRate}
          />

          <GPTSummaryCard
            diagnosis={diagnosis}
            loading={diagnosisLoading}
            error={diagnosisError}
            onRetry={handleDiagnosisRetry}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <AllocationPieChart
              title="섹터별 분산도"
              description={`${sectorData.length}개 섹터`}
              data={sectorData}
              valueFormatter={formatUsd}
              colors={DEFAULT_ALLOCATION_COLORS}
            />
            <AllocationPieChart
              title="지역별 분산도"
              description={`${regionData.length}개 지역`}
              data={regionData}
              valueFormatter={formatUsd}
              colors={DEFAULT_ALLOCATION_COLORS}
            />
          </div>

          <TopContributorsChart data={analysis.topContributors} valueFormatter={formatUsd} />

          {positions.length > 0 && <MultiStockChart positions={positions} />}

          {positions.length > 0 && (
            <RebalancingSimulator positions={positions} totalValue={analysis.totalValue} />
          )}

          <RecommendationList
            suggestions={analysis.rebalancingSuggestions}
            valueFormatter={(value) => formatUsd(value)}
          />
        </main>
      </div>
    </>
  );
}

