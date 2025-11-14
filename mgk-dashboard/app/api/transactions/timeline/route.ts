import { NextRequest, NextResponse } from 'next/server';

import { getTransactionTimeline } from '@/lib/server/transactionTimeline';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const portfolioId = searchParams.get('portfolioId');

    if (!userId || !portfolioId) {
      return NextResponse.json(
        { success: false, error: 'userId와 portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const granularityParam = searchParams.get('granularity');
    const granularity = granularityParam === 'month' ? 'month' : 'week';
    const months = searchParams.get('months') ? Number(searchParams.get('months')) : undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const purchaseMethod =
      (searchParams.get('purchaseMethod') as 'auto' | 'manual' | null) || undefined;
    const type = (searchParams.get('type') as 'buy' | 'sell' | 'dividend' | null) || undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const timeline = await getTransactionTimeline(userId, portfolioId, {
      granularity,
      months,
      limit,
      purchaseMethod,
      type,
      symbol,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data: timeline,
    });
  } catch (error) {
    console.error('[transactions/timeline] GET 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '거래 타임라인 생성 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}


