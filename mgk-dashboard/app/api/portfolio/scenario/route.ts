import { NextRequest, NextResponse } from 'next/server';

import { runScenarioAnalysis } from '@/lib/server/scenarioAnalysis';
import type { ScenarioPreset } from '@/types';

export const dynamic = 'force-dynamic';

const PRESETS: ScenarioPreset[] = ['bullish', 'bearish', 'volatile', 'custom'];

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<{
    userId: string;
    portfolioId: string;
    preset: ScenarioPreset;
    marketShiftPct: number;
    usdShiftPct: number;
    additionalContribution: number;
    notes?: string;
  }>;

  const userId = body.userId || 'default_user';
  const portfolioId = body.portfolioId;

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  const preset = body.preset && PRESETS.includes(body.preset) ? body.preset : 'custom';

  const marketShiftPct = Number.isFinite(body.marketShiftPct)
    ? Number(body.marketShiftPct)
    : 0;
  const usdShiftPct = Number.isFinite(body.usdShiftPct) ? Number(body.usdShiftPct) : 0;
  const additionalContribution = Number.isFinite(body.additionalContribution)
    ? Number(body.additionalContribution)
    : 0;

  try {
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
        error: error instanceof Error ? error.message : '시나리오 분석에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

