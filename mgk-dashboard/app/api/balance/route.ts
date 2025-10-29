/**
export const dynamic = 'force-dynamic';

 * 잔액 관리 API
 * 
 * GET: 잔액 조회
 * POST: 충전/출금 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllBalances,
  createChargeRecord,
  getChargeHistory,
  calculateChargeStats,
} from '@/lib/services/balance';

/**
 * GET /api/balance?portfolioId=xxx
 * 잔액 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = 'default_user'; // 실제로는 인증에서 가져와야 함
    const portfolioId = searchParams.get('portfolioId');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const balances = await getAllBalances(userId, portfolioId);

    const result: any = { balances };

    // 이력 포함
    if (includeHistory) {
      const limit = parseInt(searchParams.get('limit') || '10');
      const history = await getChargeHistory(userId, portfolioId, { limit });
      result.history = history;
    }

    // 통계 포함
    if (includeStats) {
      const stats = await calculateChargeStats(userId, portfolioId);
      result.stats = stats;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json(
      { error: '잔액 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/balance
 * 충전/출금 기록 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId = 'default_user', // 실제로는 인증에서 가져와야 함
      portfolioId,
      type,
      currency,
      amount,
      exchangeRate,
      convertedAmount,
      date,
      note,
    } = body;

    // 유효성 검사
    if (!portfolioId || !type || !currency || !amount || !date) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (type !== 'deposit' && type !== 'withdrawal') {
      return NextResponse.json(
        { error: 'type은 deposit 또는 withdrawal이어야 합니다.' },
        { status: 400 }
      );
    }

    if (currency !== 'KRW' && currency !== 'USD') {
      return NextResponse.json(
        { error: 'currency는 KRW 또는 USD여야 합니다.' },
        { status: 400 }
      );
    }

    const chargeId = await createChargeRecord(userId, portfolioId, {
      type,
      currency,
      amount,
      exchangeRate,
      convertedAmount,
      date,
      note,
    });

    // 업데이트된 잔액 조회
    const balances = await getAllBalances(userId, portfolioId);

    return NextResponse.json({
      success: true,
      chargeId,
      balances,
    });
  } catch (error) {
    console.error('Create charge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '충전 기록에 실패했습니다.' },
      { status: 500 }
    );
  }
}

