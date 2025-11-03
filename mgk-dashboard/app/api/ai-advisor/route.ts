import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';


import {
  callAIAdvisor,
  fetchAIAdvisorContext,
  storeAIInsight,
} from '@/lib/services/ai-advisor';
import type { AIAdvisorResult } from '@/types';

interface AdvisorRequestBody {
  periodDays?: number;
  tickers?: string[];
  store?: boolean;
  model?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as AdvisorRequestBody;

    if (!process.env.GPT_OSS_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'API 연결 실패: 인증 토큰 없음',
          code: 'MISSING_GPT_OSS_API_KEY',
        },
        { status: 500 }
      );
    }

    const context = await fetchAIAdvisorContext({
      periodDays: body.periodDays,
      tickers: body.tickers,
    });

    const result: AIAdvisorResult = await callAIAdvisor(
      {
        context,
        latestStats: undefined,
      },
      { model: body.model }
    );

    let stored = null;

    if (body.store) {
      stored = await storeAIInsight(result, context, {
        model: body.model,
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      stored,
    });
  } catch (error) {
    console.error('AI Advisor API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'AI 어드바이저 실행에 실패했습니다.',
        code: 'AI_ADVISOR_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AI 어드바이저는 POST 요청으로 실행하세요.',
    endpoint: '/api/ai-advisor',
    method: 'POST',
    body: {
      periodDays: 7,
      tickers: ['MGK'],
      store: true,
    },
  });
}

