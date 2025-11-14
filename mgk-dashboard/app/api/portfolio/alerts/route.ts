import { NextRequest, NextResponse } from 'next/server';

import { getSmartAlerts } from '@/lib/server/smartAlerts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const portfolioId = searchParams.get('portfolioId');
  const userId = searchParams.get('userId') || 'default_user';

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const alerts = await getSmartAlerts({ userId, portfolioId });
    return NextResponse.json(alerts, { status: 200 });
  } catch (error) {
    console.error('[portfolio/alerts] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '스마트 알림 조회에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

