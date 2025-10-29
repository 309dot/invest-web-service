/**
export const dynamic = 'force-dynamic';

 * 개별 종목 AI 분석 API
 * 
 * POST: 개별 종목 분석
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeStock } from '@/lib/services/ai-advisor';
import { getPortfolioPositions } from '@/lib/services/position';

/**
 * POST /api/ai/stock-analysis
 * 개별 종목 AI 분석
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, portfolioId = 'main', symbol } = body;

    if (!userId || !symbol) {
      return NextResponse.json(
        { error: 'userId와 symbol이 필요합니다.' },
        { status: 400 }
      );
    }

    // 포지션 조회
    const positions = await getPortfolioPositions(userId, portfolioId);
    const position = positions.find(p => p.symbol === symbol);

    if (!position) {
      return NextResponse.json(
        { error: '해당 종목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // TODO: 뉴스 데이터도 포함
    const analysis = await analyzeStock(position, undefined);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error('Stock analysis error:', error);
    const errorMessage = error instanceof Error ? error.message : '종목 분석에 실패했습니다.';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

