"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';

type ProfileKey = 'conservative' | 'balanced' | 'aggressive';

const PROFILE_LABELS: Record<ProfileKey, string> = {
  conservative: '안정형',
  balanced: '균형형',
  aggressive: '공격형',
};

interface PersonalizedDashboardProps {
  analysis: PortfolioAnalysis;
}

export function PersonalizedDashboard({ analysis }: PersonalizedDashboardProps) {
  const [profile, setProfile] = useState<ProfileKey>('balanced');

  const insights = useMemo(() => {
    const diversification = analysis.diversificationScore;
    const risk = analysis.riskMetrics.volatility;
    const sharpe = analysis.riskMetrics.sharpeRatio;

    if (profile === 'conservative') {
      return [
        {
          title: '안정 지표',
          description: '변동성을 낮추고 꾸준한 현금흐름을 확보하세요.',
          metric: `변동성 ${risk.toFixed(2)}%`,
        },
        {
          title: '분산 상태',
          description: '다양한 섹터에 분산 투자하면 리스크를 줄일 수 있습니다.',
          metric: `다각화 점수 ${diversification}`,
        },
      ];
    }

    if (profile === 'aggressive') {
      const topPerformer = analysis.topContributors[0];
      return [
        {
          title: '고수익 기여자',
          description: '우수한 수익 기여 종목의 비중을 점검하세요.',
          metric: topPerformer
            ? `${topPerformer.symbol} ${topPerformer.returnRate.toFixed(2)}%`
            : '데이터 부족',
        },
        {
          title: '위험 대비 성과',
          description: '샤프 비율이 1 이상이면 효율적인 성과로 판단합니다.',
          metric: `샤프 ${sharpe.toFixed(2)}`,
        },
      ];
    }

    return [
      {
        title: '포트폴리오 균형',
        description: '분산과 성과의 균형을 유지하세요.',
        metric: `다각화 ${diversification}`,
      },
      {
        title: '위험 대비 수익',
        description: '샤프 비율을 기준으로 수익률과 리스크를 동시에 관리합니다.',
        metric: `샤프 ${sharpe.toFixed(2)}`,
      },
    ];
  }, [analysis, profile]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>개인화 요약</CardTitle>
          <CardDescription>투자 성향에 맞춘 핵심 지표를 확인하세요.</CardDescription>
        </div>
        <Select value={profile} onValueChange={(value: ProfileKey) => setProfile(value)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="투자 성향" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="conservative">안정형</SelectItem>
            <SelectItem value="balanced">균형형</SelectItem>
            <SelectItem value="aggressive">공격형</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {insights.map((item, index) => (
            <div key={`${item.title}-${index}`} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <span className="text-xs text-muted-foreground">{PROFILE_LABELS[profile]}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
              <p className="text-sm font-medium">{item.metric}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">목표 대비 분산 상태</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, analysis.diversificationScore))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {analysis.diversificationScore.toFixed(0)} / 100
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

