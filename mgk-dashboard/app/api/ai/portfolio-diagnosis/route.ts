/**
 * 포트폴리오 AI 진단 API
 * 
 * POST: 포트폴리오 종합 진단
 */

import { NextRequest, NextResponse } from 'next/server';
import { diagnosePortfolio } from '@/lib/services/ai-advisor';

/**
 * POST /api/ai/portfolio-diagnosis
 * 포트폴리오 AI 진단
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, portfolioId = 'main', includeNews = false } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId가 필요합니다.' },
        { status: 400 }
      );
    }

    // TODO: includeNews가 true면 최근 뉴스도 포함
    const recentNews = includeNews ? undefined : undefined;

    const diagnosis = await diagnosePortfolio(userId, portfolioId, recentNews);

    return NextResponse.json({
      success: true,
      diagnosis,
    });
  } catch (error) {
    console.error('Portfolio diagnosis error:', error);
    const errorMessage = error instanceof Error ? error.message : '포트폴리오 진단에 실패했습니다.';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

