import { NextRequest, NextResponse } from 'next/server';
import { executeAutoInvestForToday } from '@/lib/server/autoInvestExecutor';

export const dynamic = 'force-dynamic';

function validateApiKey(request: NextRequest) {
  const configuredKey = process.env.INTERNAL_AUTOMATION_KEY;
  if (!configuredKey) {
    return true;
  }

  const headerKey = request.headers.get('x-internal-api-key');
  return headerKey === configuredKey;
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const payload = (await request.json().catch(() => ({}))) as { runDate?: string; dryRun?: boolean };
    const result = await executeAutoInvestForToday({
      runDate: payload.runDate,
      dryRun: payload.dryRun,
    });

    return NextResponse.json(
      {
        success: true,
        result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[auto-invest/execute] 실패', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '자동 투자 실행 중 오류 발생',
      },
      { status: 500 }
    );
  }
}

