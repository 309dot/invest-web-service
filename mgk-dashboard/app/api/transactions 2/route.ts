import { NextRequest, NextResponse } from 'next/server';
import { fetchTransactionsServer, calculateTransactionStatsServer, buildUpcomingAutoInvests } from '@/lib/server/transactionQueries';

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

    const filters = {
      symbol: searchParams.get('symbol') || undefined,
      type: (searchParams.get('type') as 'buy' | 'sell' | 'dividend' | null) || undefined,
      purchaseMethod: (searchParams.get('purchaseMethod') as 'auto' | 'manual' | null) || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    };

    const [transactions, stats, upcomingAutoInvests] = await Promise.all([
      fetchTransactionsServer(userId, portfolioId, filters),
      searchParams.get('includeStats') === 'true'
        ? calculateTransactionStatsServer(userId, portfolioId, filters)
        : Promise.resolve(null),
      buildUpcomingAutoInvests(userId, portfolioId),
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      stats,
      upcomingAutoInvests,
    });
  } catch (error) {
    console.error('[transactions] GET 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '거래 조회 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

