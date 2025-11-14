import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";

const EXECUTOR_URL = process.env.AUTO_INVEST_EXECUTOR_URL;
const INTERNAL_API_KEY = process.env.INTERNAL_AUTOMATION_KEY;

/**
 * 자동 투자 실행 스케줄러
 * - 매일 오전 9시(KST): 한국 시장 자동 투자 실행
 * - 매일 오전 11시(KST): 미국 시장 자동 투자 실행
 *
 * 실제 자동 투자 로직은 Next.js API에서 처리하며,
 * 이 함수는 해당 API를 호출해 실행을 트리거한다.
 */
export const executeAutoInvestJob = onSchedule(
  {
    schedule: "0 9,11 * * *",
    timeZone: "Asia/Seoul",
  },
  async (event) => {
    const triggerTimestamp = event.scheduleTime ?? new Date().toISOString();

    if (!EXECUTOR_URL) {
      logger.error(
        "[executeAutoInvestJob] AUTO_INVEST_EXECUTOR_URL 환경 변수가 설정되지 않았습니다. 작업을 중단합니다."
      );
      return;
    }

    try {
      logger.info("[executeAutoInvestJob] 자동 투자 실행 트리거 시작", {
        triggerTimestamp,
        executorUrl: EXECUTOR_URL,
      });

      const response = await fetch(EXECUTOR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(INTERNAL_API_KEY ? { "x-internal-api-key": INTERNAL_API_KEY } : {}),
        },
        body: JSON.stringify({
          triggeredAt: triggerTimestamp,
          scheduleTime: event.scheduleTime ?? null,
          eventId: event.id,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.error("[executeAutoInvestJob] 자동 투자 API 호출 실패", {
          status: response.status,
          statusText: response.statusText,
          body: text,
        });
        throw new Error(`자동 투자 API 호출 실패 (status: ${response.status})`);
      }

      const result = await response.json().catch(() => null);
      logger.info("[executeAutoInvestJob] 자동 투자 실행 트리거 완료", {
        status: response.status,
        result,
      });
    } catch (error) {
      logger.error("[executeAutoInvestJob] 자동 투자 실행 중 오류 발생", {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      });
      throw error;
    }
  }
);

