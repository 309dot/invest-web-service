import { NextRequest, NextResponse } from 'next/server';

import { getTaxOptimizationPlan } from '@/lib/server/taxOptimization';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<{
    userId: string;
    portfolioId: string;
    targetHarvestAmount: number;
    estimatedTaxRate: number;
  }>;

  const userId = body.userId || 'default_user';
  const portfolioId = body.portfolioId;

  if (!portfolioId) {
    return NextResponse.json(
      { success: false, error: 'portfolioId가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const result = await getTaxOptimizationPlan({
      userId,
      portfolioId,
      config: {
        targetHarvestAmount: body.targetHarvestAmount,
        estimatedTaxRate: body.estimatedTaxRate,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[portfolio/tax-optimization] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '세금 최적화 분석에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}

