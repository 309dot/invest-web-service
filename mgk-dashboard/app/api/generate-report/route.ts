import { NextResponse } from 'next/server';

import { saveWeeklyReport, generateWeeklySummary } from '@/lib/services/weeklyReports';
import { fetchAIAdvisorContext, callAIAdvisor, storeAIInsight } from '@/lib/services/ai-advisor';
import { buildPeriodRange } from '@/lib/utils';

export async function POST() {
  try {
    const { startDate, endDate } = buildPeriodRange(7);
    const summary = await generateWeeklySummary(startDate, endDate);

    if (!summary) {
      return NextResponse.json({
        success: false,
        error: '해당 기간에 매수 데이터가 없습니다.',
      }, { status: 400 });
    }

    const aiContext = await fetchAIAdvisorContext({ periodDays: 7 });
    const aiResult = await callAIAdvisor({ context: aiContext });
    const storedInsight = await storeAIInsight(aiResult, aiContext);

    const report = await saveWeeklyReport({
      ...summary,
      week: aiContext.startDate,
      period: `${startDate} ~ ${endDate}`,
    }, aiResult.newsHighlights ?? []);

    return NextResponse.json({
      success: true,
      data: {
        report,
        ai: storedInsight,
      },
    });
  } catch (error) {
    console.error('generate-report API error:', error);
    return NextResponse.json({
      success: false,
      error: '리포트 생성에 실패했습니다.',
      message: error instanceof Error ? error.message : '알 수 없는 오류',
    }, { status: 500 });
  }
}
