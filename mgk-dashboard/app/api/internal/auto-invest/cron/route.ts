import { NextRequest, NextResponse } from 'next/server';
import { executeAutoInvestForToday } from '@/lib/server/autoInvestExecutor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron');
  if (!cronHeader) {
    return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const result = await executeAutoInvestForToday();
    return NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[auto-invest/cron] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '자동 투자 크론 실행 중 오류 발생',
      },
      { status: 500 }
    );
  }
}


