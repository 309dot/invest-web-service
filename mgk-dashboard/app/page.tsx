"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { BalanceDashboard } from '@/components/BalanceDashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dynamic from "next/dynamic";
const AIAdvisorCard = dynamic(
  () => import("@/components/AIAdvisorCard").then((mod) => mod.AIAdvisorCard),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
        AI 어드바이저 카드를 불러오는 중입니다...
      </div>
    ),
  }
);
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

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

  const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={`text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {change}
          </p>
        )}
      </CardContent>
    </Card>
  );

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
              <Link href="/weekly-reports" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                <Calendar className="mr-1 h-4 w-4" /> 주간 리포트 보기
              </Link>
            </div>
          </div>

          {/* Tabs for Multi-Portfolio Support */}
          <Tabs defaultValue="main" className="space-y-6">
            <TabsList>
              <TabsTrigger value="main">메인 포트폴리오</TabsTrigger>
            </TabsList>

            <TabsContent value="main" className="space-y-6">
              {/* 잔액 대시보드 */}
              <BalanceDashboard portfolioId="main" />

              {/* Portfolio Overview - 새로운 다중 종목 지원 */}
              <PortfolioOverview portfolioId="main" />

              {/* AI Advisor */}
              <AIAdvisorCard />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
