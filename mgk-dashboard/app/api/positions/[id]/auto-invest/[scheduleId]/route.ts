import { NextRequest, NextResponse } from 'next/server';
import { getAutoInvestSchedule } from '@/lib/services/auto-invest';
import { getPosition } from '@/lib/services/position';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/positions/[id]/auto-invest/[scheduleId]
 * 개별 스케줄 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;
    const scheduleId = params.scheduleId;

    if (!positionId || !scheduleId) {
      return NextResponse.json(
        { error: 'Position ID와 Schedule ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const portfolioId = position.portfolioId || tentativePortfolioId;

    const schedule = await getAutoInvestSchedule(userId, portfolioId, positionId, scheduleId);

    if (!schedule) {
      return NextResponse.json({ error: '스케줄을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error('Get auto invest schedule error:', error);
    return NextResponse.json(
      { error: '자동 투자 스케줄 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

