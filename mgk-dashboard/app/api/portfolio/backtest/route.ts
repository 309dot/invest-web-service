import { NextRequest, NextResponse } from 'next/server';

import { runBacktest } from '@/lib/server/backtest';

export const dynamic = 'force-dynamic';

const STRATEGIES = new Set(['baseline', 'equal', 'growth', 'defensive', 'diversified']);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default_user';
  const portfolioId = searchParams.get('portfolioId');
  const periodDays = searchParams.get('periodDays');
  const strategy = searchParams.get('strategy');

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  const parsedPeriod = periodDays ? Number(periodDays) : undefined;
  if (parsedPeriod !== undefined && (!Number.isFinite(parsedPeriod) || parsedPeriod <= 0)) {
    return NextResponse.json(
      { success: false, error: 'periodDays는 0보다 큰 숫자여야 합니다.' },
      { status: 400 }
    );
  }

  const selectedStrategy =
    strategy && STRATEGIES.has(strategy) ? (strategy as ReturnType<typeof runBacktest>['strategy']) : undefined;

  try {
    const result = await runBacktest({
      userId,
      portfolioId,
      periodDays: parsedPeriod,
      strategy: selectedStrategy,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/backtest] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '백테스트 실행에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

