import { NextRequest, NextResponse } from 'next/server';

import { buildPersonalizedDashboard } from '@/lib/server/personalizedDashboard';

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
    const payload = await buildPersonalizedDashboard({ userId, portfolioId });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error('[dashboard/personalized] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '개인화 대시보드를 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

