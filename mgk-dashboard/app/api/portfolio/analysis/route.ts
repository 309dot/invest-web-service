export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 포트폴리오 분석 API
 * 
 * GET: 포트폴리오 분석 결과 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzePortfolio } from '@/lib/services/portfolio-analysis';
import { getPortfolioPositions } from '@/lib/services/position';
import { getPortfolioPerformancePeriods } from '@/lib/server/portfolioPerformance';

/**
 * GET /api/portfolio/analysis?portfolioId=xxx
 * 포트폴리오 분석 결과 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId');
    const userId = searchParams.get('userId') || 'default_user';

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const [analysis, positions, performance] = await Promise.all([
      analyzePortfolio(userId, portfolioId),
      getPortfolioPositions(userId, portfolioId),
      getPortfolioPerformancePeriods(),
    ]);

    return NextResponse.json({
      success: true,
      analysis,
      positions,
      performance,
    });
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return NextResponse.json(
      { error: '포트폴리오 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}

