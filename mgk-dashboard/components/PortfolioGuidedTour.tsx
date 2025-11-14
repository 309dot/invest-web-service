"use client";

import { useEffect, useMemo, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';

const TOUR_STORAGE_KEY = 'portfolio-analysis-tour';

export function PortfolioGuidedTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasCompleted = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!hasCompleted) {
      const timer = window.setTimeout(() => setRun(true), 800);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const steps: Step[] = useMemo(
    () => [
      {
        target: '[data-tour="headline"]',
        title: '오늘의 한 줄 요약',
        content: 'AI가 만든 상태 요약을 하루 한 번만 읽어도 투자 결정을 빠르게 시작할 수 있어요.',
        disableBeacon: true,
      },
      {
        target: '[data-tour="risk-cards"]',
        title: '핵심 지표 요약',
        content: '분산 점수와 변동성, 낙폭을 통해 지금 포트폴리오가 얼마나 안정적인지 확인하세요.',
      },
      {
        target: '[data-tour="ai-summary"]',
        title: 'AI 전문가 의견',
        content: '강점/약점, 우선 행동 순서를 스토리 형태로 정리했습니다. 실행 순서를 바로 확인해보세요.',
      },
      {
        target: '[data-tour="action-panel"]',
        title: '리밸런싱 & 추천',
        content: '추천 비중과 체크리스트를 참고해 다음 매수/매도 계획을 세워보세요.',
      },
    ],
    []
  );

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TOUR_STORAGE_KEY, 'done');
      }
    }
  };

  if (!steps.length) {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: '#2563eb',
          textColor: '#111827',
          zIndex: 50,
        },
      }}
    />
  );
}


