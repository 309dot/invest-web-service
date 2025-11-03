import { NextRequest, NextResponse } from 'next/server';
import {
  getTransaction,
  deleteTransaction,
} from '@/lib/services/transaction';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { recalculatePositionFromTransactions } from '@/lib/services/position';
import type { Transaction } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/transactions/[id]
 * 개별 거래 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const transactionId = params.id;

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolioId가 필요합니다.' }, { status: 400 });
    }

    const transaction = await getTransaction(userId, portfolioId, transactionId);

    if (!transaction) {
      return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    return NextResponse.json(
      { error: '거래 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transactions/[id]
 * 거래 수정 (수동 거래만 가능)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const transactionId = params.id;
    const body = await request.json();

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolioId가 필요합니다.' }, { status: 400 });
    }

    const transaction = await getTransaction(userId, portfolioId, transactionId);

    if (!transaction) {
      return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 자동 생성된 거래는 수정 불가
    if (transaction.purchaseMethod === 'auto') {
      return NextResponse.json(
        { error: '자동 생성된 거래는 수정할 수 없습니다. 스케줄을 수정해주세요.' },
        { status: 400 }
      );
    }

    const { shares, price, amount, date, memo, fee, tax, executedAt } = body;

    const transactionRef = doc(
      db,
      `users/${userId}/portfolios/${portfolioId}/transactions`,
      transactionId
    );

    const updateData: Partial<Transaction> = {
      updatedAt: Timestamp.now(),
    };

    if (shares !== undefined) updateData.shares = shares;
    if (price !== undefined) updateData.price = price;
    if (amount !== undefined) updateData.amount = amount;
    if (date !== undefined) updateData.date = date;
    if (memo !== undefined) updateData.memo = memo;
    if (fee !== undefined) updateData.fee = fee;
    if (tax !== undefined) updateData.tax = tax;
    if (executedAt !== undefined) updateData.executedAt = executedAt;

    // totalAmount 재계산
    if (amount !== undefined || fee !== undefined || tax !== undefined) {
      const amountValue = amount !== undefined ? amount : transaction.amount;
      const feeValue = fee !== undefined ? fee : transaction.fee || 0;
      const taxValue = tax !== undefined ? tax : transaction.tax || 0;
      updateData.totalAmount = transaction.type === 'buy'
        ? amountValue + feeValue + taxValue
        : Math.max(amountValue - feeValue - taxValue, 0);
    }

    await updateDoc(transactionRef, updateData);

    // 포지션 재계산
    await recalculatePositionFromTransactions(userId, portfolioId, transaction.positionId);

    const updatedTransaction = await getTransaction(userId, portfolioId, transactionId);

    return NextResponse.json({
      success: true,
      message: '거래가 수정되었습니다.',
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '거래 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transactions/[id]
 * 거래 삭제 (수동 거래만 가능)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const transactionId = params.id;

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolioId가 필요합니다.' }, { status: 400 });
    }

    const transaction = await getTransaction(userId, portfolioId, transactionId);

    if (!transaction) {
      return NextResponse.json({ error: '거래를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 자동 생성된 거래는 삭제 불가
    if (transaction.purchaseMethod === 'auto') {
      return NextResponse.json(
        { error: '자동 생성된 거래는 삭제할 수 없습니다. 스케줄을 삭제해주세요.' },
        { status: 400 }
      );
    }

    await deleteTransaction(userId, portfolioId, transactionId);

    return NextResponse.json({
      success: true,
      message: '거래가 삭제되었습니다.',
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '거래 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
