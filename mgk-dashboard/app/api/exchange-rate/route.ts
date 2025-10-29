/**
 * 환율 조회 API
 * 
 * GET: 환율 조회 (날짜별)
 */

import { NextRequest, NextResponse } from 'next/server';

// 간단한 캐시 (실제로는 Redis나 Firestore 사용 권장)
const cache = new Map<string, { rate: number; timestamp: number }>();
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

/**
 * GET /api/exchange-rate?date=2024-10-29
 * 환율 조회
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // 캐시 확인
    const cached = cache.get(date);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({
        date,
        rate: cached.rate,
        source: 'cache',
      });
    }

    // ExchangeRate-API 호출
    // 실제 환율 API 연동 (무료 플랜은 최신 환율만 제공)
    const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
    
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    const rate = data.rates.KRW;

    // 캐시 저장
    cache.set(date, { rate, timestamp: Date.now() });

    return NextResponse.json({
      date,
      rate,
      source: 'api',
      lastUpdated: data.time_last_updated,
    });
  } catch (error) {
    console.error('Exchange rate error:', error);
    
    // 폴백: 고정 환율 반환 (약 1300원/달러)
    return NextResponse.json({
      date: new Date().toISOString().split('T')[0],
      rate: 1300,
      source: 'fallback',
      note: 'Using fallback exchange rate',
    });
  }
}

/**
 * POST /api/exchange-rate/bulk
 * 여러 날짜의 환율 일괄 조회
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dates } = body;

    if (!Array.isArray(dates)) {
      return NextResponse.json(
        { error: 'dates must be an array' },
        { status: 400 }
      );
    }

    const rates: Record<string, number> = {};

    // 현재는 모든 날짜에 대해 최신 환율 반환
    // 실제로는 historical data API 사용 필요 (유료)
    const API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
    const response = await fetch(API_URL);
    
    if (response.ok) {
      const data = await response.json();
      const rate = data.rates.KRW;

      dates.forEach((date: string) => {
        rates[date] = rate;
      });
    } else {
      // 폴백
      dates.forEach((date: string) => {
        rates[date] = 1300;
      });
    }

    return NextResponse.json({ rates });
  } catch (error) {
    console.error('Bulk exchange rate error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exchange rates' },
      { status: 500 }
    );
  }
}

