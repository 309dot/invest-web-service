import { onSchedule, ScheduleEvent } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { admin, db } from "../utils/firebase";

type FirestoreTimestamp = FirebaseFirestore.Timestamp;

type FirestoreAutoInvestSchedule = {
  id: string;
  frequency: string;
  amount: number;
  currency: "USD" | "KRW";
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string;
  createdBy?: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
};

type PositionAutoInvestConfig = {
  frequency?: string;
  amount?: number;
  startDate?: string;
  isActive?: boolean;
  currentScheduleId?: string | null;
  lastExecuted?: string | null;
  lastUpdated?: string | null;
};

type ActiveAutoInvestSchedule = {
  userId: string;
  portfolioId: string;
  positionId: string;
  symbol: string;
  stockId?: string;
  market: "US" | "KR" | "GLOBAL";
  currency: "USD" | "KRW";
  positionPath: string;
  autoInvestConfig: PositionAutoInvestConfig;
  schedule: FirestoreAutoInvestSchedule;
};

/**
 * 자동 투자 실행 스케줄러 골격
 *
 * - 매일 오전 9시(KST): 한국 시장 자동 투자 대상으로 실행
 * - 매일 오전 11시(KST): 미국 시장 자동 투자 대상으로 실행
 *
 * 추후 단계에서 Firestore 스케줄 조회, 시장별 필터링, 거래 생성 등
 * 세부 로직을 채워 넣는다.
 */
export const executeAutoInvestJob = onSchedule(
  {
    schedule: "0 9,11 * * *",
    timeZone: "Asia/Seoul",
  },
  async (event) => {
    const context = createExecutionContext(event);

    logger.info("[executeAutoInvestJob] 스케줄 트리거 진입", {
      runId: context.runId,
      scheduledAt: context.scheduledAt,
      cronExpression: "0 9,11 * * *",
    });

    try {
      await runAutoInvestPipeline(context);
      logger.info("[executeAutoInvestJob] 파이프라인 실행 완료", {
        runId: context.runId,
      });
    } catch (error) {
      logger.error("[executeAutoInvestJob] 파이프라인 실행 실패", {
        runId: context.runId,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }
);

type AutoInvestRunContext = {
  runId: string;
  scheduledAt: string;
};

function createExecutionContext(event: ScheduleEvent<unknown>): AutoInvestRunContext {
  return {
    runId: event.id ?? `auto-invest-${Date.now()}`,
    scheduledAt: event.scheduleTime ?? new Date().toISOString(),
  };
}

async function runAutoInvestPipeline(context: AutoInvestRunContext): Promise<void> {
  logger.debug("[runAutoInvestPipeline] 실행 준비 완료", {
    runId: context.runId,
    scheduledAt: context.scheduledAt,
  });

  /**
   * 이후 TODO
   * 1. Firestore에서 활성 자동 투자 스케줄 로드 (auto-invest-config-loader)
   * 2. 실행 시점 기반 시장 필터링 (auto-invest-market-filter)
   * 3. 거래 생성 및 잔액 검증 파이프라인 구축 (이후 TODO 순번)
   */

  const activeSchedules = await loadActiveAutoInvestSchedules();

  logger.info("[runAutoInvestPipeline] 활성 스케줄 조회 결과", {
    runId: context.runId,
    scheduleCount: activeSchedules.length,
  });

  const marketWindow = resolveMarketWindow(context);
  const applicableSchedules = filterSchedulesByMarket(activeSchedules, marketWindow);

  logger.info("[runAutoInvestPipeline] 시장 필터 적용", {
    runId: context.runId,
    marketWindow,
    beforeCount: activeSchedules.length,
    afterCount: applicableSchedules.length,
  });

  const executionResults = await processSchedules(applicableSchedules, context, marketWindow);

  logger.info("[runAutoInvestPipeline] 스케줄 실행 요약", {
    runId: context.runId,
    totalCandidates: applicableSchedules.length,
    executed: executionResults.filter((result) => result.status === "executed").length,
    skipped: executionResults.filter((result) => result.status === "skipped").length,
    failed: executionResults.filter((result) => result.status === "failed").length,
    pendingTransactions: executionResults.reduce(
      (acc, result) => acc + (result.pendingTransactions?.length ?? 0),
      0
    ),
  });

  const pendingDrafts = executionResults.flatMap((result) => result.pendingTransactions ?? []);
  if (pendingDrafts.length > 0) {
    await persistPendingTransactions(pendingDrafts);
    logger.info("[runAutoInvestPipeline] Pending 거래 초안 저장 완료", {
      runId: context.runId,
      draftCount: pendingDrafts.length,
    });
  }
}

async function loadActiveAutoInvestSchedules(): Promise<ActiveAutoInvestSchedule[]> {
  const snapshot = await db
    .collectionGroup("positions")
    .where("autoInvestConfig.isActive", "==", true)
    .get();

  if (snapshot.empty) {
    logger.info("[loadActiveAutoInvestSchedules] 활성 포지션 없음");
    return [];
  }

  const schedules: ActiveAutoInvestSchedule[] = [];

  await Promise.all(
    snapshot.docs.map(async (docSnapshot) => {
      const positionData = docSnapshot.data() ?? {};
      const autoInvestConfig = (positionData.autoInvestConfig ?? {}) as PositionAutoInvestConfig;
      const scheduleId = autoInvestConfig.currentScheduleId;

      if (!scheduleId) {
        logger.debug("[loadActiveAutoInvestSchedules] currentScheduleId 누락으로 스킵", {
          positionPath: docSnapshot.ref.path,
        });
        return;
      }

      const pathSegments = docSnapshot.ref.path.split("/");
      if (pathSegments.length < 6) {
        logger.warn("[loadActiveAutoInvestSchedules] 예기치 않은 포지션 경로", {
          path: docSnapshot.ref.path,
        });
        return;
      }

      const [_, userId, __, portfolioId] = pathSegments;
      const positionId = docSnapshot.id;

      const scheduleRef = docSnapshot.ref.collection("autoInvestSchedules").doc(scheduleId);
      const scheduleSnapshot = await scheduleRef.get();

      if (!scheduleSnapshot.exists) {
        logger.warn("[loadActiveAutoInvestSchedules] 스케줄 문서를 찾을 수 없음", {
          path: scheduleRef.path,
        });
        return;
      }

      const scheduleData = scheduleSnapshot.data() ?? {};

      schedules.push({
        userId,
        portfolioId,
        positionId,
        symbol: String(positionData.symbol ?? ""),
        stockId: positionData.stockId ? String(positionData.stockId) : undefined,
        market: (positionData.market ?? "GLOBAL") as "US" | "KR" | "GLOBAL",
        currency: (scheduleData.currency ?? positionData.currency ?? "USD") as "USD" | "KRW",
        positionPath: docSnapshot.ref.path,
        autoInvestConfig,
        schedule: {
          id: scheduleSnapshot.id,
          frequency: String(scheduleData.frequency ?? autoInvestConfig.frequency ?? "monthly"),
          amount: Number(scheduleData.amount ?? autoInvestConfig.amount ?? 0),
          currency: (scheduleData.currency ?? positionData.currency ?? "USD") as "USD" | "KRW",
          effectiveFrom: String(scheduleData.effectiveFrom ?? autoInvestConfig.startDate ?? ""),
          effectiveTo: (scheduleData.effectiveTo ?? null) as string | null | undefined,
          note: scheduleData.note,
          createdBy: scheduleData.createdBy,
          createdAt: scheduleData.createdAt,
          updatedAt: scheduleData.updatedAt,
        },
      });
    })
  );

  return schedules;
}

type MarketWindow = "KR" | "US";

function resolveMarketWindow(context: AutoInvestRunContext): MarketWindow {
  const scheduledDate = new Date(context.scheduledAt);
  if (Number.isNaN(scheduledDate.getTime())) {
    logger.warn("[resolveMarketWindow] scheduledAt 파싱 실패, 기본값 KR 사용", {
      scheduledAt: context.scheduledAt,
    });
    return "KR";
  }

  const kstHour = (scheduledDate.getUTCHours() + 9) % 24;

  if (kstHour === 9) {
    return "KR";
  }

  if (kstHour === 11) {
    return "US";
  }

  // 비정상 호출 시 가까운 시장을 추정 (오전=KR, 오후=US)
  return kstHour < 12 ? "KR" : "US";
}

function filterSchedulesByMarket(
  schedules: ActiveAutoInvestSchedule[],
  marketWindow: MarketWindow
): ActiveAutoInvestSchedule[] {
  return schedules.filter((schedule) => {
    const market = schedule.market;
    if (market === "GLOBAL") {
      return true;
    }

    if (marketWindow === "KR") {
      return market === "KR";
    }

    return market === "US";
  });
}

type ScheduleExecutionStatus = "executed" | "skipped" | "failed";

type ScheduleExecutionResult = {
  status: ScheduleExecutionStatus;
  scheduleId: string;
  userId: string;
  portfolioId: string;
  positionId: string;
  message?: string;
  pendingTransactions?: PendingTransactionDraft[];
};

type PendingTransactionDraft = {
  runId: string;
  userId: string;
  portfolioId: string;
  positionId: string;
  scheduleId: string;
  symbol: string;
  stockId?: string;
  currency: "USD" | "KRW";
  amount: number;
  scheduledDate: string;
  status: "pending";
  market: "US" | "KR" | "GLOBAL";
};

type AutomationAlertSeverity = "info" | "warning" | "error";

type AutomationAlertPayload = {
  userId: string;
  portfolioId: string;
  severity: AutomationAlertSeverity;
  title: string;
  body: string;
  tags?: string[];
  context?: Record<string, unknown>;
};

function resolveExecutionDate(context: AutoInvestRunContext, marketWindow: MarketWindow): string {
  const scheduledDate = new Date(context.scheduledAt);
  const offsetHours = marketWindow === "KR" ? 9 : -5; // KST / (approx) ET
  const adjusted = new Date(scheduledDate.getTime() + offsetHours * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

async function processSchedules(
  schedules: ActiveAutoInvestSchedule[],
  context: AutoInvestRunContext,
  marketWindow: MarketWindow
): Promise<ScheduleExecutionResult[]> {
  const results: ScheduleExecutionResult[] = [];

  for (const schedule of schedules) {
    try {
      const result = await generateAutoInvestTransactions(schedule, context, marketWindow);
      logger.info("[processSchedules] 스케줄 처리 완료", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        status: result.status,
        message: result.message,
        pendingTransactions: result.pendingTransactions?.length ?? 0,
      });
      results.push(result);
    } catch (error) {
      logger.error("[processSchedules] 스케줄 실행 중 오류", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });

      results.push({
        status: "failed",
        scheduleId: schedule.schedule.id,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        message: error instanceof Error ? error.message : "알 수 없는 오류",
      });
    }
  }

  return results;
}

async function generateAutoInvestTransactions(
  schedule: ActiveAutoInvestSchedule,
  context: AutoInvestRunContext,
  marketWindow: MarketWindow
): Promise<ScheduleExecutionResult> {
  try {
    logger.debug("[generateAutoInvestTransactions] 실행 준비", {
      runId: context.runId,
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      positionId: schedule.positionId,
      scheduleId: schedule.schedule.id,
    });

    const executionDate = resolveExecutionDate(context, marketWindow);

    /**
     * TODO (후속 작업)
     * - 거래 생성 로직 구현
     * - 잔액 검증 및 공제
     * - Firestore에 거래 기록 저장
     * - 경고/알림 시스템 연동
     */

    const scheduleAmount = Number(schedule.schedule.amount ?? 0);
    if (!Number.isFinite(scheduleAmount) || scheduleAmount <= 0) {
      logger.warn("[generateAutoInvestTransactions] 스케줄 금액이 유효하지 않아 건너뜀", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        amount: schedule.schedule.amount,
      });

      return {
        status: "skipped",
        scheduleId: schedule.schedule.id,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        message: "스케줄 금액이 유효하지 않습니다.",
      };
    }

    const effectiveFrom = (schedule.schedule.effectiveFrom ?? schedule.autoInvestConfig.startDate ?? "").trim();
    if (effectiveFrom && executionDate < effectiveFrom) {
      logger.info("[generateAutoInvestTransactions] 효력 시작 이전으로 실행 보류", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        executionDate,
        effectiveFrom,
      });

      return {
        status: "skipped",
        scheduleId: schedule.schedule.id,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        message: `효력 시작일(${effectiveFrom}) 이전`,
      };
    }

    const effectiveTo = schedule.schedule.effectiveTo ? String(schedule.schedule.effectiveTo).trim() : "";
    if (effectiveTo && executionDate > effectiveTo) {
      logger.info("[generateAutoInvestTransactions] 스케줄 종료 이후로 실행 보류", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        executionDate,
        effectiveTo,
      });

      return {
        status: "skipped",
        scheduleId: schedule.schedule.id,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        message: `스케줄 종료일(${effectiveTo}) 이후`,
      };
    }

    const currentBalance = await getPortfolioBalance(
      schedule.userId,
      schedule.portfolioId,
      schedule.schedule.currency
    );

    if (currentBalance < scheduleAmount) {
      logger.warn("[generateAutoInvestTransactions] 잔액 부족으로 거래 생성을 건너뜀", {
        runId: context.runId,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        scheduleId: schedule.schedule.id,
        currency: schedule.schedule.currency,
        requiredAmount: scheduleAmount,
        currentBalance,
      });

      await recordAutomationAlert({
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        severity: "warning",
        title: "자동 투자 잔액 부족",
        body: `${schedule.symbol} 자동 투자 금액 ${scheduleAmount.toFixed(2)} ${schedule.schedule.currency} 실행을 위해 잔액이 부족합니다.`,
        tags: ["auto-invest", "insufficient-balance"],
        context: {
          scheduleId: schedule.schedule.id,
          positionId: schedule.positionId,
          symbol: schedule.symbol,
          requiredAmount: scheduleAmount,
          currentBalance,
          currency: schedule.schedule.currency,
          executionDate,
        },
      });

      return {
        status: "skipped",
        scheduleId: schedule.schedule.id,
        userId: schedule.userId,
        portfolioId: schedule.portfolioId,
        positionId: schedule.positionId,
        message: `잔액 부족 (${schedule.schedule.currency} ${scheduleAmount})`,
      };
    }

    const balanceImpact = await deductPortfolioBalance(
      schedule.userId,
      schedule.portfolioId,
      schedule.schedule.currency,
      scheduleAmount
    );

    const pendingTransaction: PendingTransactionDraft = {
      runId: context.runId,
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      positionId: schedule.positionId,
      scheduleId: schedule.schedule.id,
      symbol: schedule.symbol,
      stockId: schedule.stockId,
      currency: schedule.schedule.currency,
      amount: scheduleAmount,
      scheduledDate: executionDate,
      status: "pending",
      market: schedule.market,
    };

    return {
      status: "executed",
      scheduleId: schedule.schedule.id,
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      positionId: schedule.positionId,
      message: `잔액 차감 완료 (잔액 ${balanceImpact.previous.toFixed(2)} → ${balanceImpact.remaining.toFixed(2)})`,
      pendingTransactions: [pendingTransaction],
    };
  } catch (error) {
    logger.error("[generateAutoInvestTransactions] 스케줄 처리 오류", {
      runId: context.runId,
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      positionId: schedule.positionId,
      scheduleId: schedule.schedule.id,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });

    await recordAutomationAlert({
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      severity: "error",
      title: "자동 투자 실행 실패",
      body: `${schedule.symbol} 자동 투자 실행 중 오류가 발생했습니다.`,
      tags: ["auto-invest", "execution-error"],
      context: {
        scheduleId: schedule.schedule.id,
        positionId: schedule.positionId,
        symbol: schedule.symbol,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      },
    });

    return {
      status: "failed",
      scheduleId: schedule.schedule.id,
      userId: schedule.userId,
      portfolioId: schedule.portfolioId,
      positionId: schedule.positionId,
      message: error instanceof Error ? error.message : "알 수 없는 오류",
    };
  }
}

async function getPortfolioBalance(
  userId: string,
  portfolioId: string,
  currency: "USD" | "KRW"
): Promise<number> {
  const balanceRef = db
    .collection("users")
    .doc(userId)
    .collection("portfolios")
    .doc(portfolioId)
    .collection("balance")
    .doc(currency);

  const snapshot = await balanceRef.get();
  if (!snapshot.exists) {
    return 0;
  }

  const rawBalance = snapshot.data()?.balance;
  const balance = Number(rawBalance ?? 0);

  if (!Number.isFinite(balance)) {
    logger.warn("[getPortfolioBalance] 잔액 값이 숫자가 아님", {
      userId,
      portfolioId,
      currency,
      rawBalance,
    });
    return 0;
  }

  return balance;
}

async function deductPortfolioBalance(
  userId: string,
  portfolioId: string,
  currency: "USD" | "KRW",
  amount: number
): Promise<{ previous: number; remaining: number }> {
  return db.runTransaction(async (tx) => {
    const balanceRef = db
      .collection("users")
      .doc(userId)
      .collection("portfolios")
      .doc(portfolioId)
      .collection("balance")
      .doc(currency);

    const snapshot = await tx.get(balanceRef);
    const current = snapshot.exists ? Number(snapshot.data()?.balance ?? 0) : 0;

    if (!Number.isFinite(current) || current < amount) {
      throw new Error("잔액 부족");
    }

    const remaining = current - amount;

    tx.set(
      balanceRef,
      {
        userId,
        portfolioId,
        currency,
        balance: remaining,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: snapshot.exists
          ? snapshot.data()?.createdAt ?? admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { previous: current, remaining };
  });
}

async function persistPendingTransactions(drafts: PendingTransactionDraft[]): Promise<void> {
  await Promise.all(
    drafts.map(async (draft) => {
      const transactionsRef = db
        .collection("users")
        .doc(draft.userId)
        .collection("portfolios")
        .doc(draft.portfolioId)
        .collection("transactions");

      const documentId = `auto-${draft.scheduleId}-${draft.scheduledDate}`;
      const transactionRef = transactionsRef.doc(documentId);

      await db.runTransaction(async (tx) => {
        const snapshot = await tx.get(transactionRef);

        if (snapshot.exists) {
          const existingStatus = snapshot.data()?.status;
          if (existingStatus && existingStatus !== "pending") {
            logger.info("[persistPendingTransactions] 기존 확정 거래가 있어 Pending 저장을 건너뜁니다.", {
              userId: draft.userId,
              portfolioId: draft.portfolioId,
              positionId: draft.positionId,
              scheduleId: draft.scheduleId,
              scheduledDate: draft.scheduledDate,
              existingStatus,
            });
            return;
          }
        }

        const createdAt = snapshot.exists
          ? snapshot.data()?.createdAt ?? admin.firestore.FieldValue.serverTimestamp()
          : admin.firestore.FieldValue.serverTimestamp();

        tx.set(
          transactionRef,
          {
            portfolioId: draft.portfolioId,
            positionId: draft.positionId,
            stockId: draft.stockId ?? draft.symbol,
            symbol: draft.symbol,
            type: "buy",
            date: draft.scheduledDate,
            scheduledDate: draft.scheduledDate,
            status: "pending",
            purchaseMethod: "auto",
            purchaseUnit: "amount",
            amount: draft.amount,
            totalAmount: draft.amount,
            shares: 0,
            price: 0,
            fee: 0,
            tax: 0,
            currency: draft.currency,
            market: draft.market,
            runId: draft.runId,
            pending: true,
            createdAt,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    })
  );
}

async function recordAutomationAlert(payload: AutomationAlertPayload): Promise<void> {
  try {
    const alertsRef = db
      .collection("users")
      .doc(payload.userId)
      .collection("automationAlerts");

    await alertsRef.add({
      severity: payload.severity,
      title: payload.title,
      body: payload.body,
      tags: payload.tags ?? [],
      context: payload.context ?? {},
      portfolioId: payload.portfolioId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "auto-invest",
    });
  } catch (error) {
    logger.error("[recordAutomationAlert] 알림 저장 실패", {
      userId: payload.userId,
      portfolioId: payload.portfolioId,
      severity: payload.severity,
      title: payload.title,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    });
  }
}

export {
  resolveMarketWindow,
  filterSchedulesByMarket,
  generateAutoInvestTransactions,
  getPortfolioBalance,
  deductPortfolioBalance,
  persistPendingTransactions,
  recordAutomationAlert,
};

