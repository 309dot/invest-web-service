import { NextRequest, NextResponse } from 'next/server';
import { reapplySchedule } from '@/lib/services/auto-invest';
import { getPosition } from '@/lib/services/position';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/positions/[id]/auto-invest/reapply
 * 과거 스케줄 재적용
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;
    const body = await request.json();

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
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

    const { scheduleId, effectiveFrom, pricePerShare } = body;

    if (!scheduleId || !effectiveFrom) {
      return NextResponse.json(
        { error: 'scheduleId와 effectiveFrom이 필요합니다.' },
        { status: 400 }
      );
    }

    const result = await reapplySchedule(userId, portfolioId, positionId, scheduleId, {
      effectiveFrom,
      pricePerShare,
      symbol: position.symbol,
      stockId: position.stockId,
      currency: position.currency,
      market: position.market === 'GLOBAL' ? undefined : position.market,
    });

    return NextResponse.json({
      success: true,
      message: '스케줄이 재적용되었습니다.',
      removed: result.removed,
      created: result.created,
      newScheduleId: result.newScheduleId,
    });
  } catch (error) {
    console.error('Reapply schedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '스케줄 재적용에 실패했습니다.' },
      { status: 500 }
    );
  }
}

