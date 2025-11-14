import { NextRequest, NextResponse } from 'next/server';

import { getStockComparisonData } from '@/lib/server/stockComparison';
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
  const includeBenchmarksParam = searchParams.get('includeBenchmarks');
  const periodParam = searchParams.get('period');

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  const includeBenchmarks = includeBenchmarksParam !== 'false';
  const period = normalizePeriod(periodParam);

  try {
    const positions = await getPortfolioPositions(userId, portfolioId);
    if (!positions.length) {
      return NextResponse.json(
        {
          success: true,
          period,
          baseCurrency: 'KRW',
          includeBenchmarks,
          series: [],
          generatedAt: new Date().toISOString(),
          meta: { positions: 0 },
        },
        { status: 200 }
      );
    }

    const result = await getStockComparisonData({
      positions,
      period,
      includeBenchmarks,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/comparison] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '종목 비교 데이터를 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

