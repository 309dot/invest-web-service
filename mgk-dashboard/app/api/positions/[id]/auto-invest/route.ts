import { NextRequest, NextResponse } from 'next/server';
import {
  createAutoInvestSchedule,
  listAutoInvestSchedules,
  rewriteAutoInvestTransactions,
  deleteAutoInvestSchedule,
} from '@/lib/services/auto-invest';
import type { AutoInvestFailure } from '@/lib/services/auto-invest';
import { getPosition } from '@/lib/services/position';
import { deriveDefaultPortfolioId } from '@/lib/utils/portfolio';
import type { AutoInvestSchedule } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
    }

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const effectivePortfolioId = position.portfolioId || tentativePortfolioId;
    const schedules = await listAutoInvestSchedules(userId, effectivePortfolioId, positionId);

    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error('Get auto invest schedules error:', error);
    return NextResponse.json(
      { error: '자동 투자 스케줄을 불러오지 못했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;
    const body = await request.json();

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
    }

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const portfolioId = position.portfolioId || tentativePortfolioId;

    const { frequency, amount, effectiveFrom, note, regenerate = true, pricePerShare } = body;

    if (!frequency || typeof amount !== 'number' || !effectiveFrom) {
      return NextResponse.json(
        { error: 'frequency, amount, effectiveFrom 값이 필요합니다.' },
        { status: 400 }
      );
    }

    let scheduleId: string;
    try {
      scheduleId = await createAutoInvestSchedule(userId, portfolioId, positionId, {
        frequency,
        amount,
        currency: position.currency,
        effectiveFrom,
        createdBy: userId,
        note,
      });
    } catch (error) {
      console.error('Failed to create auto invest schedule:', error);
      return NextResponse.json(
        { error: `자동 투자 스케줄 저장에 실패했습니다: ${getErrorMessage(error)}` },
        { status: 500 }
      );
    }

    let rewriteSummary:
      | { removed: number; created: number; failures: AutoInvestFailure[]; error?: string }
      | null = null;
    if (regenerate) {
      try {
        rewriteSummary = await rewriteAutoInvestTransactions(userId, portfolioId, positionId, {
          effectiveFrom,
          frequency,
          amount,
          currency: position.currency,
          pricePerShare:
            typeof pricePerShare === 'number' && pricePerShare > 0 ? pricePerShare : undefined,
          symbol: position.symbol,
          stockId: position.stockId,
          market: position.market === 'GLOBAL' ? undefined : position.market,
        });
      } catch (error) {
        console.error('Failed to regenerate auto invest transactions:', error);
        rewriteSummary = {
          removed: 0,
          created: 0,
          failures: [],
          error: getErrorMessage(error),
        };
      }
    }

    let schedules: AutoInvestSchedule[] = [];
    try {
      schedules = await listAutoInvestSchedules(userId, portfolioId, positionId);
    } catch (error) {
      console.error('Failed to list auto invest schedules:', error);
    }

    const failureCount = rewriteSummary?.failures?.length ?? 0;
    const hasError = Boolean(rewriteSummary?.error);
    const status: 'success' | 'partial' | 'error' = hasError
      ? 'error'
      : failureCount > 0
        ? 'partial'
        : 'success';
    const success = status !== 'error';

    const message = hasError
      ? `자동 투자 거래 재생성에 실패했습니다: ${rewriteSummary?.error}`
      : failureCount > 0
        ? `자동 투자 스케줄이 저장되었지만 ${failureCount}건의 거래가 생성되지 않았습니다.`
        : '자동 투자 스케줄이 저장되었습니다.';

    const failureSummary = rewriteSummary?.failures.map((failure) => ({
      date: failure.date,
      amount: failure.amount,
      currency: failure.currency,
      reason: failure.reason,
      message: failure.message,
      metadata: failure.metadata,
    }));

    return NextResponse.json({
      success,
      status,
      message,
      scheduleId,
      schedules,
      rewriteSummary,
      failures: failureSummary,
      portfolioId,
    });
  } catch (error) {
    console.error('Create auto invest schedule error:', error);
    return NextResponse.json(
      { error: `자동 투자 스케줄 저장 중 오류가 발생했습니다: ${getErrorMessage(error)}` },
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
    const positionId = params.id;
    const body = await request.json();

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
    }

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const portfolioId = position.portfolioId || tentativePortfolioId;

    const { scheduleId, frequency, amount, effectiveFrom, note, regenerateTransactions = false } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    // 스케줄 업데이트
    // await updateAutoInvestSchedule(userId, portfolioId, positionId, scheduleId, {
    //   frequency,
    //   amount,
    //   effectiveFrom,
    //   note,
    // });

    // 거래 재생성 옵션이 활성화된 경우
    let rewriteSummary:
      | { removed: number; created: number; failures: AutoInvestFailure[]; error?: string }
      | null = null;
    if (regenerateTransactions && effectiveFrom) {
      try {
        rewriteSummary = await rewriteAutoInvestTransactions(userId, portfolioId, positionId, {
          effectiveFrom,
          frequency: frequency || position.autoInvestConfig?.frequency || 'monthly',
          amount: amount || position.autoInvestConfig?.amount || 0,
          currency: position.currency,
          symbol: position.symbol,
          stockId: position.stockId,
          market: position.market === 'GLOBAL' ? undefined : position.market,
        });
      } catch (error) {
        console.error('Failed to regenerate auto invest transactions:', error);
        rewriteSummary = {
          removed: 0,
          created: 0,
          failures: [],
          error: getErrorMessage(error),
        };
      }
    }

    const schedules = await listAutoInvestSchedules(userId, portfolioId, positionId);

    const failureCount = rewriteSummary?.failures?.length ?? 0;
    const status: 'success' | 'partial' | 'error' =
      (rewriteSummary?.error ? 'error' : failureCount > 0 ? 'partial' : 'success');

    return NextResponse.json({
      success: true,
      message:
        failureCount > 0
          ? `자동 투자 스케줄이 수정되었지만 ${failureCount}건의 거래 생성이 누락되었습니다.`
          : '자동 투자 스케줄이 수정되었습니다.',
      schedules,
      rewriteSummary,
      failures: rewriteSummary?.failures,
      status,
    });
  } catch (error) {
    console.error('Update auto invest schedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '자동 투자 스케줄 수정에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = request.nextUrl.searchParams.get('userId') || 'default_user';
    const positionId = params.id;
    const scheduleId = request.nextUrl.searchParams.get('scheduleId');
    const deleteTransactions = request.nextUrl.searchParams.get('deleteTransactions') === 'true';

    if (!positionId) {
      return NextResponse.json({ error: 'Position ID가 필요합니다.' }, { status: 400 });
    }

    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId가 필요합니다.' }, { status: 400 });
    }

    const fallbackPortfolioId =
      userId && userId !== 'default_user' ? deriveDefaultPortfolioId(userId) : 'main';
    const portfolioIdParam = request.nextUrl.searchParams.get('portfolioId');
    const tentativePortfolioId = portfolioIdParam || fallbackPortfolioId;

    const position = await getPosition(userId, tentativePortfolioId, positionId);
    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const portfolioId = position.portfolioId || tentativePortfolioId;

    const result = await deleteAutoInvestSchedule(
      userId,
      portfolioId,
      positionId,
      scheduleId,
      deleteTransactions
    );

    const schedules = await listAutoInvestSchedules(userId, portfolioId, positionId);

    return NextResponse.json({
      success: true,
      message: '자동 투자 스케줄이 삭제되었습니다.',
      deletedTransactions: result.deletedTransactions,
      schedules,
    });
  } catch (error) {
    console.error('Delete auto invest schedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '자동 투자 스케줄 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}

