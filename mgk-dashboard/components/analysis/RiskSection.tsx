"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Gauge, Info, Target, TrendingDown } from 'lucide-react';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';

interface RiskSectionProps {
  diversificationScore: number;
  riskMetrics: PortfolioAnalysis['riskMetrics'];
  overallReturnRate: number;
}

const DIVERSIFICATION_LEVELS = [
  { threshold: 80, label: '매우 우수', color: 'text-green-600' },
  { threshold: 60, label: '우수', color: 'text-blue-600' },
  { threshold: 40, label: '보통', color: 'text-yellow-600' },
  { threshold: 20, label: '부족', color: 'text-orange-600' },
  { threshold: 0, label: '매우 부족', color: 'text-red-600' },
];

function getDiversificationLevel(score: number) {
  return DIVERSIFICATION_LEVELS.find((level) => score >= level.threshold) ?? DIVERSIFICATION_LEVELS[DIVERSIFICATION_LEVELS.length - 1];
}

export function RiskSection({ diversificationScore, riskMetrics, overallReturnRate }: RiskSectionProps) {
  const diversificationLevel = getDiversificationLevel(diversificationScore);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            다각화 점수
            <span title="섹터·지역·자산 유형 분산을 0~100 사이 점수로 환산한 값입니다.">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{diversificationScore}</div>
          <p className={`text-sm ${diversificationLevel.color} mt-1`}>{diversificationLevel.label}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            변동성
            <span title="수익률의 표준편차로 계산되며, 값이 높을수록 가격이 크게 흔들린다는 의미입니다.">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{riskMetrics.volatility.toFixed(2)}%</div>
          <p className="text-sm text-muted-foreground mt-1">표준편차</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            샤프 비율
            <span title="무위험 수익률 대비 초과 수익을 변동성으로 나눈 값입니다. 1 이상이면 효율적인 성과로 해석합니다.">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{riskMetrics.sharpeRatio.toFixed(2)}</div>
          <p className="text-sm text-muted-foreground mt-1">위험 대비 수익</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            최대 낙폭
            <span title="기간 중 최고점 대비 최저점까지의 최대 하락률입니다. 손실 위험을 가늠하는 지표입니다.">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">{riskMetrics.maxDrawdown.toFixed(2)}%</div>
          <p className="text-sm text-muted-foreground mt-1">Max Drawdown</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            집중도 & 수익률
            <span title="Herfindahl-Hirschman Index(HHI) 기반 집중도와 포트폴리오 누적 수익률입니다.">
              <Info className="h-3 w-3 text-muted-foreground" />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">포트폴리오 집중도 (HHI)</p>
            <p className="text-2xl font-semibold">{riskMetrics.concentration.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              0에 가까울수록 고르게 분산되어 있습니다.
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">전체 수익률</p>
            <p className={`text-2xl font-semibold ${overallReturnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overallReturnRate.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">포트폴리오 누적 수익률</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

