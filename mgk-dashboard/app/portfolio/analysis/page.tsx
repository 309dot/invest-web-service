"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Header } from '@/components/Header';
import { RebalancingSimulator } from '@/components/RebalancingSimulator';
import { MultiStockChart } from '@/components/MultiStockChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Award,
  Target,
  Activity,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import type { Position } from '@/types';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

export default function PortfolioAnalysisPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/portfolio/analysis?portfolioId=main');
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('Failed to fetch analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnalysis();
    }
  }, [user]);

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
              <p className="text-muted-foreground mb-4">
                종목을 추가하여 포트폴리오 분석을 시작하세요.
              </p>
              <Button onClick={() => router.push('/')}>
                대시보드로 이동
              </Button>
            </div>
          </main>
        </div>
      </>
    );
  }

  const getDiversificationLevel = (score: number): { label: string; color: string } => {
    if (score >= 80) return { label: '매우 우수', color: 'text-green-600' };
    if (score >= 60) return { label: '우수', color: 'text-blue-600' };
    if (score >= 40) return { label: '보통', color: 'text-yellow-600' };
    if (score >= 20) return { label: '부족', color: 'text-orange-600' };
    return { label: '매우 부족', color: 'text-red-600' };
  };

  const diversificationLevel = getDiversificationLevel(analysis.diversificationScore);

  return (
    <>
      <Header />
      <div className="min-h-screen p-4 md:p-8">
        <main className="max-w-7xl mx-auto space-y-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">포트폴리오 분석</h1>
              <p className="text-muted-foreground">
                섹터/지역별 분산도 및 리스크 분석
              </p>
            </div>
            <Button onClick={fetchAnalysis} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>

          {/* 핵심 지표 카드 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  다각화 점수
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analysis.diversificationScore}</div>
                <p className={`text-sm ${diversificationLevel.color} mt-1`}>
                  {diversificationLevel.label}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  변동성
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analysis.riskMetrics.volatility.toFixed(2)}%</div>
                <p className="text-sm text-muted-foreground mt-1">표준편차</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  샤프 비율
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{analysis.riskMetrics.sharpeRatio.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground mt-1">위험 대비 수익</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  최대 낙폭
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {analysis.riskMetrics.maxDrawdown.toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">Max Drawdown</p>
              </CardContent>
            </Card>
          </div>

          {/* 차트 영역 */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* 섹터별 분산도 */}
            <Card>
              <CardHeader>
                <CardTitle>섹터별 분산도</CardTitle>
                <CardDescription>
                  {analysis.sectorAllocation.length}개 섹터
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analysis.sectorAllocation}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ sector, percentage }) => `${sector}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analysis.sectorAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value, 'USD')} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analysis.sectorAllocation.map((sector, index) => (
                    <div key={sector.sector} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="capitalize">{sector.sector}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{sector.percentage.toFixed(1)}%</span>
                        <span className={sector.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatPercent(sector.returnRate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 지역별 분산도 */}
            <Card>
              <CardHeader>
                <CardTitle>지역별 분산도</CardTitle>
                <CardDescription>
                  {analysis.regionAllocation.length}개 지역
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analysis.regionAllocation}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ region, percentage }) => `${region}: ${percentage.toFixed(1)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {analysis.regionAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value, 'USD')} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analysis.regionAllocation.map((region, index) => (
                    <div key={region.region} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span>{region.region === 'US' ? '미국' : '한국'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{region.percentage.toFixed(1)}%</span>
                        <span className={region.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatPercent(region.returnRate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 상위 기여자 */}
          <Card>
            <CardHeader>
              <CardTitle>수익 기여도 Top 5</CardTitle>
              <CardDescription>수익에 가장 많이 기여한 종목</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysis.topContributors}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value, 'USD')} />
                  <Bar dataKey="contribution" fill="#8884d8">
                    {analysis.topContributors.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.contribution >= 0 ? '#00C49F' : '#FF8042'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 다중 종목 비교 차트 */}
          {positions.length > 0 && (
            <MultiStockChart positions={positions} />
          )}

          {/* 리밸런싱 시뮬레이터 */}
          {positions.length > 0 && (
            <RebalancingSimulator 
              positions={positions} 
              totalValue={analysis.totalValue} 
            />
          )}

          {/* 리밸런싱 제안 */}
          {analysis.rebalancingSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>자동 리밸런싱 제안</CardTitle>
                <CardDescription>
                  균등 비중 기준 자동 제안
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.rebalancingSuggestions.map((suggestion) => (
                    <div key={suggestion.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{suggestion.symbol}</span>
                          <Badge variant={suggestion.action === 'buy' ? 'default' : 'destructive'}>
                            {suggestion.action === 'buy' ? '매수' : '매도'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          현재: {suggestion.currentWeight.toFixed(1)}% → 목표: {suggestion.targetWeight.toFixed(1)}%
                        </div>
                        <div className="font-semibold">
                          {formatCurrency(suggestion.amount, 'USD')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </>
  );
}

