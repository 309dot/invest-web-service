"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { BalanceDashboard } from '@/components/BalanceDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';
import { BenchmarkComparison } from '@/components/analysis/BenchmarkComparison';
import { PeriodPerformanceTabs } from '@/components/analysis/PeriodPerformanceTabs';
import { StockComparisonChart } from '@/components/analysis/StockComparisonChart';
import { ContributionBreakdown } from '@/components/analysis/ContributionBreakdown';
import { CorrelationHeatmap } from '@/components/analysis/CorrelationHeatmap';
import { SmartAlertsPanel } from '@/components/SmartAlertsPanel';
import { ScenarioAnalysis } from '@/components/ScenarioAnalysis';
import { BacktestCard } from '@/components/BacktestCard';
import { PortfolioOptimizerCard } from '@/components/PortfolioOptimizerCard';
import { TaxOptimizationCard } from '@/components/TaxOptimizationCard';
import { PersonalizedDashboard } from '@/components/PersonalizedDashboard';
import { SellAlertBanner } from '@/components/SellAlertBanner';
import { WeeklyReportModal } from '@/components/WeeklyReportModal';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isE2EMode = process.env.NEXT_PUBLIC_E2E === 'true';

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const portfolioId = deriveDefaultPortfolioId(user.uid);

  return (
    <>
      <Header />
      <div className="min-h-screen p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">포트폴리오 대시보드</h1>
            <p className="text-muted-foreground">
              실시간 투자 추적 및 AI 기반 분석 시스템
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <WeeklyReportModal />
            </div>
          </div>

          {/* Tabs for Multi-Portfolio Support */}
          <Tabs defaultValue={portfolioId} className="space-y-6">
            <TabsList>
              <TabsTrigger value={portfolioId}>메인 포트폴리오</TabsTrigger>
            </TabsList>

            <TabsContent value={portfolioId} className="space-y-6">
              {isE2EMode ? (
                <>
                  {/* 종목 비교 차트 (E2E 핵심 시나리오) */}
                  <StockComparisonChart portfolioId={portfolioId} />
                </>
              ) : (
                <>
                  <SellAlertBanner userId={user.uid} portfolioId={portfolioId} />

                  {/* 잔액 대시보드 */}
                  <BalanceDashboard portfolioId={portfolioId} />

                  {/* 개인화 요약 */}
                  <PersonalizedDashboard portfolioId={portfolioId} />

                  {/* 스마트 알림 */}
                  <SmartAlertsPanel portfolioId={portfolioId} />

                  {/* 시나리오 분석 */}
                  <ScenarioAnalysis portfolioId={portfolioId} />

                  {/* 백테스트 */}
                  <BacktestCard portfolioId={portfolioId} />

                  {/* 포트폴리오 최적화 */}
                  <PortfolioOptimizerCard portfolioId={portfolioId} />

                  {/* 세금 최적화 */}
                  <TaxOptimizationCard portfolioId={portfolioId} />

                  {/* 벤치마크 비교 */}
                  <BenchmarkComparison portfolioId={portfolioId} />

                  {/* 종목 비교 차트 */}
                  <StockComparisonChart portfolioId={portfolioId} />

                  {/* 기여도 분석 */}
                  <ContributionBreakdown portfolioId={portfolioId} />

                  {/* 상관관계 히트맵 */}
                  <CorrelationHeatmap portfolioId={portfolioId} />

                  {/* 기간별 성과 */}
                  <PeriodPerformanceTabs portfolioId={portfolioId} />

                  {/* Portfolio Overview - 새로운 다중 종목 지원 */}
                  <PortfolioOverview portfolioId={portfolioId} />
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
