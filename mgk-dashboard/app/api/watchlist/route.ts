import { NextResponse } from 'next/server';

import {
  addWatchlistItem,
  listWatchlistItems,
  removeWatchlistItem,
  updateWatchlistItem,
} from '@/lib/services/portfolio';

export async function GET() {
  try {
    const items = await listWatchlistItems();
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('Watchlist fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '관심 종목을 불러올 수 없습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.symbol) {
      return NextResponse.json(
        { success: false, error: '심볼은 필수입니다.' },
        { status: 400 }
      );
    }

    const id = await addWatchlistItem({
      symbol: body.symbol,
      targetPrice: body.targetPrice,
      memo: body.memo,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Watchlist add error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '관심 종목을 추가하지 못했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      );
    }

    await updateWatchlistItem(body.id, {
      targetPrice: body.targetPrice,
      memo: body.memo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '관심 종목을 수정하지 못했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id가 필요합니다.' },
        { status: 400 }
      );
    }

    await removeWatchlistItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Watchlist delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '관심 종목을 삭제하지 못했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

