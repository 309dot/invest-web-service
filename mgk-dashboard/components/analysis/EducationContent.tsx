"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const EDUCATION_ITEMS = [
  {
    id: 'diversification',
    title: '다각화(Diversification)',
    description:
      '자산을 여러 섹터와 지역에 분산하면 특정 종목이나 시장 변동에 대한 의존도가 낮아집니다. 점수가 높을수록 위험 분산이 잘 된 상태입니다.',
    tips: [
      '동일 섹터 비중이 30%를 넘지 않도록 조정하세요.',
      '국내외 비중을 조절해 환율 리스크를 분산시키세요.',
    ],
  },
  {
    id: 'volatility',
    title: '변동성(Volatility)',
    description:
      '수익률의 표준편차로 측정하며 값이 높을수록 가격이 크게 흔들립니다. 동일한 수익률이라도 변동성이 낮은 포트폴리오가 더 안정적입니다.',
    tips: [
      '포트폴리오 변동성이 20% 이상이면 방어형 자산 비중을 검토하세요.',
      '고변동 종목은 투자 비중을 낮추거나 장기 투자 관점에서 접근하세요.',
    ],
  },
  {
    id: 'sharpe',
    title: '샤프 비율(Sharpe Ratio)',
    description:
      '무위험 자산 대비 초과 수익률을 변동성으로 나눈 지표입니다. 1 이상이면 위험 대비 효율적인 포트폴리오로 평가합니다.',
    tips: [
      '샤프 비율이 낮다면 수익률을 높이거나 변동성을 줄여야 합니다.',
      '시장 하락기에는 방어형 자산으로 변동성을 낮추는 전략이 유효합니다.',
    ],
  },
];

export function EducationContent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>지표 이해하기</CardTitle>
        <CardDescription>핵심 지표의 의미와 활용법을 빠르게 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {EDUCATION_ITEMS.map((item) => (
            <div key={item.id} className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold">{item.title}</h4>
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {item.tips.map((tip, index) => (
                  <li key={`${item.id}-tip-${index}`}>{tip}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

