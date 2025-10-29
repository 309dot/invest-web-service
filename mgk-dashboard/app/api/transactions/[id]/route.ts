/**
 * 개별 거래 관리 API
 * 
 * GET: 거래 조회
 * DELETE: 거래 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteTransaction, getTransaction } from '@/lib/services/transaction';

/**
 * GET /api/transactions/[id]
 * 거래 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const portfolioId = 'main'; // URL 파라미터로 받아야 함
    const transactionId = params.id;

    const transaction = await getTransaction(userId, portfolioId, transactionId);

    if (!transaction) {
      return NextResponse.json(
        { error: '거래를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    return NextResponse.json(
      { error: '거래 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]?portfolioId=xxx
 * 거래 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const searchParams = request.nextUrl.searchParams;
    const portfolioId = searchParams.get('portfolioId') || 'main';
    const transactionId = params.id;

    await deleteTransaction(userId, portfolioId, transactionId);

    return NextResponse.json({
      success: true,
      message: '거래가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return NextResponse.json(
      { error: '거래 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

