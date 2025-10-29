"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { PortfolioOverview } from '@/components/PortfolioOverview';
import { BalanceDashboard } from '@/components/BalanceDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PriceChart } from "@/components/PriceChart";
import { ManualEntry } from "@/components/ManualEntry";
import { WatchlistManager } from "@/components/WatchlistManager";
import Link from "next/link";
import { formatCurrency, formatPercent, formatDate, formatShares } from "@/lib/utils/formatters";
import { TrendingUp, TrendingDown, DollarSign, PieChart, AlertTriangle, Calendar, Loader2 } from 'lucide-react';

// 샘플 데이터 생성
function generateSampleData() {
  const data = [];
  const basePrice = 500;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  for (let i = 0; i < 90; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const price = basePrice + (Math.random() - 0.5) * 50 + (i * 0.5);
    const shares = 0.02 * (i + 1);
    const avgPrice = basePrice + (i * 0.3);
    const totalValue = price * shares;
    const returnRate = ((price - avgPrice) / avgPrice) * 100;

    data.push({
      date: date.toISOString().split('T')[0],
      price: parseFloat(price.toFixed(2)),
      returnRate: parseFloat(returnRate.toFixed(2)),
      totalValue: parseFloat(totalValue.toFixed(2)),
      shares,
    });
  }

  return data;
}

const samplePurchases = [
  { date: '2024-10-20', price: 520.50, shares: 0.0192, totalValue: 9.99 },
  { date: '2024-10-19', price: 518.20, shares: 0.0193, totalValue: 10.00 },
  { date: '2024-10-18', price: 525.80, shares: 0.0190, totalValue: 9.99 },
  { date: '2024-10-17', price: 522.40, shares: 0.0191, totalValue: 9.98 },
  { date: '2024-10-16', price: 519.60, shares: 0.0192, totalValue: 9.98 },
];

const sampleNews = [
  { title: 'Tech Stocks Rally on Strong Earnings', importance: 'High' as const, time: '2시간 전', source: 'Bloomberg' },
  { title: 'Fed Signals Potential Rate Cut', importance: 'High' as const, time: '4시간 전', source: 'Reuters' },
  { title: 'Market Analysis: Q4 Outlook', importance: 'Medium' as const, time: '6시간 전', source: 'CNBC' },
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [chartData, setChartData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    currentPrice: 525.50,
    totalShares: 1.8,
    totalValue: 946.90,
    returnRate: 3.45,
    todayChange: 2.30,
    todayChangePercent: 0.44,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    setChartData(generateSampleData());
  }, []);

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

              {/* Legacy Section: MGK 단일 종목 (옵션) */}
              <Card>
                <CardHeader>
                  <CardTitle>레거시 MGK 데이터</CardTitle>
                  <CardDescription>기존 단일 종목 추적 시스템</CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>데모 모드</AlertTitle>
                    <AlertDescription>
                      현재 샘플 데이터를 표시하고 있습니다. Firebase를 설정하면 실제 데이터가 표시됩니다.
                    </AlertDescription>
                  </Alert>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="현재 MGK 주가"
            value={formatCurrency(stats.currentPrice)}
            change={`+${formatCurrency(stats.todayChange)} (${formatPercent(stats.todayChangePercent)})`}
            icon={DollarSign}
            trend="up"
          />
          <StatCard
            title="총 보유량"
            value={`${formatShares(stats.totalShares)} 주`}
            icon={PieChart}
          />
          <StatCard
            title="총 평가액"
            value={formatCurrency(stats.totalValue)}
            change={`전일 대비 +${formatCurrency(stats.todayChange * stats.totalShares)}`}
            icon={TrendingUp}
            trend="up"
          />
          <StatCard
            title="총 수익률"
            value={formatPercent(stats.returnRate)}
            change={`+${formatCurrency(stats.totalValue * (stats.returnRate / 100))}`}
            icon={TrendingUp}
            trend="up"
          />
        </div>

        {/* Chart */}
        <PriceChart data={chartData} />

        {/* Tables */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Purchases */}
          <Card>
            <CardHeader>
              <CardTitle>최근 매수 기록</CardTitle>
              <CardDescription>최근 5개의 매수 내역</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>날짜</TableHead>
                    <TableHead>주가</TableHead>
                    <TableHead className="text-right">주식 수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samplePurchases.map((purchase, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {formatDate(purchase.date, 'MM/dd')}
                      </TableCell>
                      <TableCell>{formatCurrency(purchase.price)}</TableCell>
                      <TableCell className="text-right">{formatShares(purchase.shares)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent News */}
          <Card>
            <CardHeader>
              <CardTitle>최근 뉴스</CardTitle>
              <CardDescription>시장 관련 주요 뉴스</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sampleNews.map((news, idx) => (
                  <div key={idx} className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">{news.title}</p>
                      <p className="text-xs text-muted-foreground">{news.source} • {news.time}</p>
                    </div>
                    <Badge variant={news.importance === 'High' ? 'default' : 'secondary'}>
                      {news.importance}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

              {/* Watchlist */}
              <WatchlistManager />

              {/* Manual Entry */}
              <ManualEntry />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
