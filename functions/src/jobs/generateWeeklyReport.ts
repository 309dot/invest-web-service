import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

import { generateWeeklySummary, saveWeeklyReport } from '@/lib/services/weeklyReports';
import { fetchAIAdvisorContext, callAIAdvisor, storeAIInsight } from '@/lib/services/ai-advisor';
import { buildPeriodRange } from '@/lib/utils';

export const generateWeeklyReportJob = onSchedule({
  schedule: "0 21 * * 0",
  timeZone: "Asia/Seoul",
}, async () => {
  logger.info('[generateWeeklyReportJob] 시작');

  try {
    const { startDate, endDate } = buildPeriodRange(7);
    const summary = await generateWeeklySummary(startDate, endDate);

    if (!summary) {
      logger.warn('[generateWeeklyReportJob] 해당 기간 데이터 없음', { startDate, endDate });
      return;
    }

    const context = await fetchAIAdvisorContext({ periodDays: 7 });
    const aiResult = await callAIAdvisor({ context });
    await storeAIInsight(aiResult, context);

    await saveWeeklyReport({
      ...summary,
      week: context.startDate,
      period: `${startDate} ~ ${endDate}`,
    }, aiResult.newsHighlights ?? []);

    logger.info('[generateWeeklyReportJob] 완료', { period: `${startDate} ~ ${endDate}` });
  } catch (error) {
    logger.error('[generateWeeklyReportJob] 실패', error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error);
    throw error;
  }
});
