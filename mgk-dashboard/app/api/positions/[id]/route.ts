import { NextRequest, NextResponse } from 'next/server';
import { deletePosition, getPosition, updatePositionAfterTransaction } from '@/lib/services/position';

export const dynamic = 'force-dynamic';

/**
 * GET /api/positions/[id]
 * 특정 포지션 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const positionId = params.id;

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // portfolioId는 positionId에서 추출 (예: main_AAPL -> main)
    const portfolioId = positionId.split('_')[0];

    const position = await getPosition(userId, portfolioId, positionId);

    if (!position) {
      return NextResponse.json(
        { error: '포지션을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      position,
    });
  } catch (error) {
    console.error('Get position error:', error);
    return NextResponse.json(
      { error: '포지션 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/positions/[id]
 * 포지션 수정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = 'default_user';
    const positionId = params.id;
    const body = await request.json();

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const portfolioId = positionId.split('_')[0];

    // 포지션 업데이트 로직
    await updatePositionAfterTransaction(userId, portfolioId, positionId, {
      type: 'buy',
      shares: body.shares || 0,
      price: body.averagePrice || 0,
      date: new Date().toISOString().split('T')[0],
    });

    return NextResponse.json({
      success: true,
      message: '포지션이 수정되었습니다.',
    });
  } catch (error) {
    console.error('Update position error:', error);
    return NextResponse.json(
      { error: '포지션 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/positions/[id]
 * 포지션 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const positionId = params.id;

    console.log('🗑️ Deleting position:', positionId);

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // portfolioId는 positionId에서 추출 (예: main_AAPL -> main)
    const portfolioId = positionId.split('_')[0];

    console.log('📊 Portfolio ID:', portfolioId);

    await deletePosition(userId, portfolioId, positionId);

    console.log('✅ Position deleted successfully');

    return NextResponse.json({
      success: true,
      message: '포지션이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('❌ Delete position error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '포지션 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

