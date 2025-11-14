import { NextRequest, NextResponse } from 'next/server';

import { runPortfolioOptimization } from '@/lib/server/portfolioOptimizer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default_user';
  const portfolioId = searchParams.get('portfolioId');

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const response = await runPortfolioOptimization({ userId, portfolioId });
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[portfolio/optimizer] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '포트폴리오 최적화에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

