import { NextResponse } from 'next/server';

import { listRecentAIInsights } from '@/lib/services/ai-advisor';

export async function GET() {
  try {
    const insights = await listRecentAIInsights();
    return NextResponse.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('AI Advisor history API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'AI 인사이트 히스토리를 불러오지 못했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

