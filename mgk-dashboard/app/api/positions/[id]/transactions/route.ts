import { NextRequest, NextResponse } from 'next/server';
import { getPositionTransactions } from '@/lib/services/transaction';
import { getPosition } from '@/lib/services/position';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/positions/[id]/transactions
 * 특정 포지션의 모든 거래 내역 조회
 */
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

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const portfolioId = position.portfolioId || tentativePortfolioId;

    const transactions = await getPositionTransactions(userId, portfolioId, positionId);

    return NextResponse.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Get position transactions error:', error);
    return NextResponse.json(
      { error: '거래 내역 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

