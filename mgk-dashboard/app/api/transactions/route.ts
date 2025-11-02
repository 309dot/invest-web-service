/**
export const dynamic = 'force-dynamic';

 * 거래 관리 API
 * 
 * POST: 새 거래 생성
 * GET: 포트폴리오의 거래 이력 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createTransaction,
  getPortfolioTransactions,
  calculateTransactionStats,
} from '@/lib/services/transaction';

/**
 * POST /api/transactions
 * 새 거래 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default_user', // 실제로는 인증에서 가져와야 함
      portfolioId,
      positionId,
      type,
      symbol,
      shares,
      price,
      amount,
      date,
      fee,
      tax,
      note,
      exchangeRate,
      currency,
    } = body;

    if (!userId || userId === 'default_user') {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 유효성 검사
    if (!portfolioId || !positionId || !type || !symbol || !shares || !price || !date) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (type !== 'buy' && type !== 'sell') {
      return NextResponse.json(
        { error: '거래 타입은 buy 또는 sell이어야 합니다.' },
        { status: 400 }
      );
    }

    const transactionId = await createTransaction(
      userId,
      portfolioId,
      positionId,
      {
        type,
        symbol,
        shares,
        price,
        amount: amount || shares * price,
        date,
        fee,
        tax,
        note,
        exchangeRate,
        currency,
      }
    );

    return NextResponse.json({
      success: true,
      transactionId,
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '거래 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transactions?portfolioId=xxx&symbol=xxx&type=xxx&limit=xxx
 * 포트폴리오의 거래 이력 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'default_user';
    const portfolioId = searchParams.get('portfolioId');
    const symbol = searchParams.get('symbol') || undefined;
    const type = searchParams.get('type') as 'buy' | 'sell' | undefined;
    const limitParam = searchParams.get('limit');
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const includeStats = searchParams.get('includeStats') === 'true';

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const limit = limitParam ? parseInt(limitParam) : undefined;

    const transactions = await getPortfolioTransactions(userId, portfolioId, {
      symbol,
      type,
      limit,
      startDate,
      endDate,
    });

    const result: any = { transactions };

    // 통계 포함
    if (includeStats) {
      const stats = await calculateTransactionStats(
        userId,
        portfolioId,
        startDate && endDate ? { startDate, endDate } : undefined
      );
      result.stats = stats;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { error: '거래 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

