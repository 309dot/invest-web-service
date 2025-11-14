"use client";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Gauge, Target, TrendingDown } from 'lucide-react';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { GlossaryPopover } from '@/components/ui/glossary-popover';

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
            <GlossaryPopover
              title="다각화 점수"
              description="보유 자산이 얼마나 여러 섹터와 지역에 분산되어 있는지를 점수화한 지표입니다."
              example="한 종목 비중이 50% 이상이면 점수가 크게 낮아집니다."
            />
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
            <GlossaryPopover
              title="변동성"
              description="수익률의 흔들림 정도를 나타냅니다. 값이 클수록 하루 수익이 크게 출렁입니다."
              example="ETF 10%, 성장주 30% 수준이면 중간 변동성입니다."
            />
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
            <GlossaryPopover
              title="샤프 비율"
              description="추가로 감수한 위험 대비 얼마나 많은 초과 수익을 냈는지 보여주는 대표 지표입니다."
              example="1.0 이상이면 우수, 0 미만이면 위험 대비 수익이 부족합니다."
            />
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
            <GlossaryPopover
              title="최대 낙폭 (MDD)"
              description="투자 기간 동안 기록한 가장 큰 하락 폭입니다. 감내 가능한 손실 범위를 확인할 수 있습니다."
              example="-30%라면 최고점 대비 30%까지 하락했던 적이 있다는 뜻입니다."
            />
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

