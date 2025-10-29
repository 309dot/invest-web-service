import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';


export async function GET() {
  try {
    // Firebase 설정 후 실제 Firestore 데이터에서 가져오기
    // 현재는 샘플 통계 데이터 반환

    const stats = {
      currentPrice: 525.50,
      totalShares: 1.8,
      totalValue: 946.90,
      totalInvested: 900,
      returnRate: 5.21,
      averagePrice: 510.20,
      todayChange: 2.30,
      todayChangePercent: 0.44,
      dollarBalance: 150,
      totalPurchases: 90,
      lastPurchaseDate: '2024-10-20',
      nextChargeNeeded: '약 15일 후',
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Stats calculation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to calculate stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
