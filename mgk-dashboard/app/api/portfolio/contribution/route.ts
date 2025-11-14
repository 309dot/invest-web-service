import { NextRequest, NextResponse } from 'next/server';

import { getContributionBreakdown } from '@/lib/server/contributionAnalysis';
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

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  const period = normalizePeriod(periodParam);

  try {
    const positions = await getPortfolioPositions(userId, portfolioId);
    if (!positions.length) {
      return NextResponse.json(
        {
          success: true,
          period,
          baseCurrency: 'KRW',
          entries: [],
          totals: {
            totalContributionPct: 0,
            totalContributionValue: 0,
            totalInvested: 0,
            totalValue: 0,
          },
          generatedAt: new Date().toISOString(),
        },
        { status: 200 }
      );
    }

    const result = await getContributionBreakdown({
      positions,
      period,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/contribution] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '기여도 데이터를 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

