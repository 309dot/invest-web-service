/**
export const dynamic = 'force-dynamic';

 * 포트폴리오 분석 API
 * 
 * GET: 포트폴리오 분석 결과 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzePortfolio } from '@/lib/services/portfolio-analysis';
import { getPortfolioPositions } from '@/lib/services/position';

/**
 * GET /api/portfolio/analysis?portfolioId=xxx
 * 포트폴리오 분석 결과 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const analysis = await analyzePortfolio(userId, portfolioId);
    const positions = await getPortfolioPositions(userId, portfolioId);

    return NextResponse.json({
      success: true,
      analysis,
      positions,
    });
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    return NextResponse.json(
      { error: '포트폴리오 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}

