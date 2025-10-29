import { NextRequest, NextResponse } from 'next/server';
import { ensureStock } from '@/lib/services/stock-master';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stocks/master
 * 종목 마스터에 저장
 */
export async function POST(request: NextRequest) {
  try {
    const stockData = await request.json();

    const stockId = await ensureStock(stockData);

    return NextResponse.json({
      success: true,
      stockId,
    });
  } catch (error) {
    console.error('Stock master API error:', error);
    return NextResponse.json(
      { success: false, error: '종목 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

