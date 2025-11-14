import { NextRequest, NextResponse } from 'next/server';

import {
  getPersonalizationSettings,
  updatePersonalizationSettings,
} from '@/lib/server/personalizationSettings';
import type { InvestmentGoal, RiskProfile } from '@/types';

export const dynamic = 'force-dynamic';

const RISK_PROFILES: RiskProfile[] = ['conservative', 'balanced', 'aggressive'];
const INVESTMENT_GOALS: InvestmentGoal[] = ['growth', 'income', 'balanced', 'capital-preservation'];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const settings = await getPersonalizationSettings(userId);
    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (error) {
    console.error('[settings/personalization] GET 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '개인화 설정을 불러오지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId') || 'default_user';

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<{
      riskProfile: string;
      investmentGoal: string;
      focusAreas: string[];
    }>;

    const updates: Partial<{
      riskProfile: RiskProfile;
      investmentGoal: InvestmentGoal;
      focusAreas: string[];
    }> = {};

    if (body.riskProfile) {
      if (!RISK_PROFILES.includes(body.riskProfile as RiskProfile)) {
        return NextResponse.json(
          { success: false, error: '허용되지 않은 riskProfile 값입니다.' },
          { status: 400 }
        );
      }
      updates.riskProfile = body.riskProfile as RiskProfile;
    }

    if (body.investmentGoal) {
      if (!INVESTMENT_GOALS.includes(body.investmentGoal as InvestmentGoal)) {
        return NextResponse.json(
          { success: false, error: '허용되지 않은 investmentGoal 값입니다.' },
          { status: 400 }
        );
      }
      updates.investmentGoal = body.investmentGoal as InvestmentGoal;
    }

    if (Array.isArray(body.focusAreas)) {
      updates.focusAreas = body.focusAreas.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: '업데이트할 필드가 필요합니다.' },
        { status: 400 }
      );
    }

    const settings = await updatePersonalizationSettings(userId, updates);
    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (error) {
    console.error('[settings/personalization] PATCH 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '개인화 설정을 업데이트하지 못했습니다.',
      },
      { status: 500 }
    );
  }
}

