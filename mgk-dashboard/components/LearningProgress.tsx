"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const STORAGE_KEY = 'learning-progress';

const DEFAULT_MILESTONES: Milestone[] = [
  {
    id: 'hold-3m',
    title: '포트폴리오 3개월 유지',
    description: '중간에 해지하지 않고 동일 전략을 유지해보기',
    completed: false,
  },
  {
    id: 'rebalance-1',
    title: '리밸런싱 1회 실행',
    description: '목표 비중에 맞춰 실제 매수/매도 진행',
    completed: false,
  },
  {
    id: 'loss-cut',
    title: '손실 종목 점검',
    description: '손실 종목의 보유 이유를 기록하고 필요 시 정리',
    completed: false,
  },
];

export function LearningProgress() {
  const [milestones, setMilestones] = useState<Milestone[]>(DEFAULT_MILESTONES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Milestone[];
        setMilestones(
          DEFAULT_MILESTONES.map((item) => parsed.find((m) => m.id === item.id) || item)
        );
      } catch {
        // ignore
      }
    }
    setLoading(false);
  }, []);

  const completedCount = milestones.filter((item) => item.completed).length;
  const progressValue = Math.round((completedCount / milestones.length) * 100);

  const handleToggle = (id: string) => {
    setMilestones((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const handleReset = () => {
    setMilestones(DEFAULT_MILESTONES);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>학습 진도 추적</CardTitle>
          <CardDescription>기본 투자 습관을 얼마나 실천했는지 체크하세요.</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          초기화
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            진행 상황을 불러오는 중입니다...
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>학습 달성률</span>
                <span>{progressValue}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
            <ul className="space-y-3">
              {milestones.map((milestone) => (
                <li key={milestone.id} className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    checked={milestone.completed}
                    onCheckedChange={() => handleToggle(milestone.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">{milestone.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}


