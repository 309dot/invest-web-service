import { NextRequest, NextResponse } from 'next/server';

import { runScenarioAnalysis } from '@/lib/server/scenarioAnalysis';
import type { ScenarioPreset } from '@/types';

export const dynamic = 'force-dynamic';

const PRESETS: ScenarioPreset[] = ['bullish', 'bearish', 'volatile', 'custom'];

function normalizePreset(value: unknown): ScenarioPreset {
  if (typeof value !== 'string') {
    return 'bullish';
  }
  if (PRESETS.includes(value as ScenarioPreset)) {
    return value as ScenarioPreset;
  }
  return 'bullish';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      portfolioId?: string;
      preset?: ScenarioPreset;
      marketShiftPct?: number;
      usdShiftPct?: number;
      additionalContribution?: number;
      notes?: string;
    };

    const userId = body.userId ?? 'default_user';
    const portfolioId = body.portfolioId;

    if (!portfolioId) {
      return NextResponse.json(
        { success: false, error: 'portfolioId가 필요합니다.' },
        { status: 400 }
      );
    }

    const preset = normalizePreset(body.preset);
    const marketShiftPct = Number.isFinite(body.marketShiftPct) ? Number(body.marketShiftPct) : 0;
    const usdShiftPct = Number.isFinite(body.usdShiftPct) ? Number(body.usdShiftPct) : 0;
    const additionalContribution = Number.isFinite(body.additionalContribution)
      ? Number(body.additionalContribution)
      : 0;

    const result = await runScenarioAnalysis({
      userId,
      portfolioId,
      preset,
      marketShiftPct,
      usdShiftPct,
      additionalContribution,
      notes: body.notes,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/scenario] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '시나리오 분석을 실행하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}
