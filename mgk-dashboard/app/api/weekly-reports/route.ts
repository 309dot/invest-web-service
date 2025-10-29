import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';


import { getDocumentsWithLimit } from '@/lib/firestore';
import { listRecentAIInsights } from '@/lib/services/ai-advisor';
import type { WeeklyReportWithAI } from '@/types';

export async function GET() {
  try {
    const [reports, insights] = await Promise.all([
      getDocumentsWithLimit<WeeklyReportWithAI>('weeklyReports', 10, 'generatedAt', 'desc'),
      listRecentAIInsights(20),
    ]);

    const insightsMap = new Map(insights.map((insight) => [insight.id, insight]));

    const enrichedReports = reports.map((report) => {
      const insightId = report.aiAdvice?.sourceInsightId;
      const linkedInsight = insightId ? insightsMap.get(insightId) : null;

      return {
        ...report,
        aiAdvice: linkedInsight
          ? {
              weeklySummary: linkedInsight.weeklySummary,
              newsHighlights: linkedInsight.newsHighlights,
              recommendations: linkedInsight.recommendations,
              signals: linkedInsight.signals,
              confidenceScore: linkedInsight.confidenceScore,
              rawText: linkedInsight.rawText,
              generatedAt: linkedInsight.generatedAt,
              sourceInsightId: linkedInsight.id,
            }
          : report.aiAdvice ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedReports,
    });
  } catch (error) {
    console.error('Weekly reports API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '주간 리포트를 불러오지 못했습니다.',
        message: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

