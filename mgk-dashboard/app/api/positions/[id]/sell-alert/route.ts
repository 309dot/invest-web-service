import { NextRequest, NextResponse } from 'next/server';
import { getPosition, updateSellAlertSettings } from '@/lib/services/position';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const positionId = params.id;

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolioId가 필요합니다.' }, { status: 400 });
    }

    if (!positionId) {
      return NextResponse.json({ error: 'positionId가 필요합니다.' }, { status: 400 });
    }

    const position = await getPosition(userId, portfolioId, positionId);

    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const sellAlert = position.sellAlert ?? {
      enabled: false,
      targetReturnRate: 0,
      sellRatio: 100,
      notifyEmail: null,
      triggerOnce: true,
      lastTriggeredAt: null,
    };

    return NextResponse.json({ sellAlert });
  } catch (error) {
    console.error('Sell alert fetch error:', error);
    return NextResponse.json(
      { error: '매도 알림 설정을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const portfolioId = request.nextUrl.searchParams.get('portfolioId');
    const positionId = params.id;

    if (!portfolioId) {
      return NextResponse.json({ error: 'portfolioId가 필요합니다.' }, { status: 400 });
    }

    if (!positionId) {
      return NextResponse.json({ error: 'positionId가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const enabled = Boolean(body.enabled);

    const targetReturnRateValue =
      body.targetReturnRate !== undefined ? parseFloat(String(body.targetReturnRate)) : undefined;
    const sellRatioValue =
      body.sellRatio !== undefined ? parseFloat(String(body.sellRatio)) : undefined;
    const triggerOnceValue =
      body.triggerOnce !== undefined ? Boolean(body.triggerOnce) : undefined;
    const bodyEmail =
      typeof body.accountEmail === 'string' && body.accountEmail.trim()
        ? body.accountEmail.trim()
        : undefined;
    const accountEmailParam = request.nextUrl.searchParams.get('userEmail') || undefined;
    const resolvedEmail = bodyEmail || accountEmailParam || undefined;

    if (enabled) {
      if (targetReturnRateValue === undefined || Number.isNaN(targetReturnRateValue) || targetReturnRateValue <= 0) {
        return NextResponse.json(
          { error: '활성화 시 목표 수익률(%)을 0보다 크게 입력해야 합니다.' },
          { status: 400 }
        );
      }
    }

    if (sellRatioValue !== undefined && !Number.isNaN(sellRatioValue)) {
      if (sellRatioValue < 0 || sellRatioValue > 100) {
        return NextResponse.json(
          { error: '매도 비율은 0~100 범위여야 합니다.' },
          { status: 400 }
        );
      }
    }

    const sanitizedTarget =
      targetReturnRateValue !== undefined && !Number.isNaN(targetReturnRateValue)
        ? targetReturnRateValue
        : undefined;
    const sanitizedRatio =
      sellRatioValue !== undefined && !Number.isNaN(sellRatioValue)
        ? sellRatioValue
        : undefined;

    const sellAlert = await updateSellAlertSettings(userId, portfolioId, positionId, {
      enabled,
      targetReturnRate: sanitizedTarget,
      sellRatio: sanitizedRatio,
      triggerOnce: triggerOnceValue,
      accountEmail: resolvedEmail ?? null,
    });

    return NextResponse.json({ success: true, sellAlert });
  } catch (error) {
    console.error('Sell alert update error:', error);
    const message = error instanceof Error ? error.message : '매도 알림 설정 저장에 실패했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


