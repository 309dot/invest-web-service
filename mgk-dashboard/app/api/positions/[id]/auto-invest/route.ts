import { NextRequest, NextResponse } from 'next/server';
import {
  createAutoInvestSchedule,
  listAutoInvestSchedules,
  rewriteAutoInvestTransactions,
} from '@/lib/services/auto-invest';
import { getPosition } from '@/lib/services/position';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
    }

    const portfolioId = positionId.split('_')[0];
    const schedules = await listAutoInvestSchedules(userId, portfolioId, positionId);

    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error('Get auto invest schedules error:', error);
    return NextResponse.json(
      { error: '자동 투자 스케줄을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

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

    const portfolioId = positionId.split('_')[0];

    const position = await getPosition(userId, portfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const { frequency, amount, effectiveFrom, note, regenerate = true, pricePerShare } = body;

    if (!frequency || typeof amount !== 'number' || !effectiveFrom) {
      return NextResponse.json(
        { error: 'frequency, amount, effectiveFrom 값이 필요합니다.' },
        { status: 400 }
      );
    }

    if (regenerate && (typeof pricePerShare !== 'number' || pricePerShare <= 0)) {
      return NextResponse.json(
        { error: '거래 재생성을 위해서는 pricePerShare 값을 제공해야 합니다.' },
        { status: 400 }
      );
    }

    const scheduleId = await createAutoInvestSchedule(userId, portfolioId, positionId, {
      frequency,
      amount,
      currency: position.currency,
      effectiveFrom,
      createdBy: userId,
      note,
    });

    let rewriteSummary: { removed: number; created: number } | null = null;
    if (regenerate && typeof pricePerShare === 'number' && pricePerShare > 0) {
      rewriteSummary = await rewriteAutoInvestTransactions(userId, portfolioId, positionId, {
        effectiveFrom,
        frequency,
        amount,
        currency: position.currency,
        pricePerShare,
        symbol: position.symbol,
        stockId: position.stockId,
      });
    }

    const schedules = await listAutoInvestSchedules(userId, portfolioId, positionId);

    return NextResponse.json({
      success: true,
      scheduleId,
      schedules,
      rewriteSummary,
    });
  } catch (error) {
    console.error('Create auto invest schedule error:', error);
    return NextResponse.json(
      { error: '자동 투자 스케줄 저장에 실패했습니다.' },
      { status: 500 }
    );
  }
}

