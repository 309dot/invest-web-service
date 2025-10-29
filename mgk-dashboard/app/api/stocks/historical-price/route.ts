import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalPrice } from '@/lib/apis/alphavantage';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stocks/historical-price?symbol=AAPL&date=2024-01-15
 * 특정 날짜의 주식 종가를 반환
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const date = searchParams.get('date');

    if (!symbol || !date) {
      return NextResponse.json(
        { success: false, error: 'symbol과 date 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    const price = await getHistoricalPrice(symbol, date);

    if (price === null) {
      return NextResponse.json(
        { success: false, error: '해당 날짜의 가격을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      symbol,
      date,
      price,
    });
  } catch (error) {
    console.error('Historical price API error:', error);
    return NextResponse.json(
      { success: false, error: '가격 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

