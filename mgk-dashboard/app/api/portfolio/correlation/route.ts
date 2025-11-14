import { NextRequest, NextResponse } from 'next/server';

import { getCorrelationMatrix } from '@/lib/server/stockCorrelation';
import { getPortfolioPositions } from '@/lib/services/position';
import type { StockComparisonPeriod } from '@/types';

export const dynamic = 'force-dynamic';

const PERIODS: StockComparisonPeriod[] = ['1m', '3m', '6m', '1y'];

function normalizePeriod(value: string | null): StockComparisonPeriod {
  if (!value) {
    return '3m';
  }
  const lowered = value.toLowerCase();
  if (PERIODS.includes(lowered as StockComparisonPeriod)) {
    return lowered as StockComparisonPeriod;
  }
  return '3m';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default_user';
  const portfolioId = searchParams.get('portfolioId');
  const periodParam = searchParams.get('period');
  const includeBenchmarksParam = searchParams.get('includeBenchmarks');

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  const period = normalizePeriod(periodParam);
  const includeBenchmarks = includeBenchmarksParam === 'true';

  try {
    const positions = await getPortfolioPositions(userId, portfolioId);
    if (!positions.length) {
      return NextResponse.json(
        {
          success: true,
          period,
          baseCurrency: 'KRW',
          symbols: [],
          matrix: [],
          generatedAt: new Date().toISOString(),
          meta: { positions: 0 },
        },
        { status: 200 }
      );
    }

    const result = await getCorrelationMatrix({
      positions,
      period,
      includeBenchmarks,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/correlation] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '상관관계 데이터를 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

