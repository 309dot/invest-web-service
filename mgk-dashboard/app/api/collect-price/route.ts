import { NextResponse } from 'next/server';
import { getCurrentPrice } from '@/lib/apis/alphavantage';
import { getExchangeRate } from '@/lib/apis/exchangerate';

export async function POST() {
  try {
    // MGK 주가 수집
    const priceData = await getCurrentPrice('MGK');

    // USD/KRW 환율 수집
    const exchangeData = await getExchangeRate();

    // 응답 데이터
    const result = {
      success: true,
      data: {
        price: priceData.price,
        change: priceData.change,
        changePercent: priceData.changePercent,
        exchangeRate: exchangeData.rate,
        timestamp: new Date().toISOString(),
      },
    };

    // Firebase 설정 후 Firestore에 저장하는 로직 추가
    console.log('수집된 데이터:', result.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Price collection error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to collect price data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to collect price data',
    endpoint: '/api/collect-price',
    method: 'POST',
  });
}
