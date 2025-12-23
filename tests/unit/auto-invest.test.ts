import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: vi.fn((config, handler) => ({ config, handler })),
}));

vi.mock("firebase-functions/logger", () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const mockRunTransaction = vi.fn();

vi.mock("../../functions/src/utils/firebase", () => ({
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => new Date()),
      },
    },
  },
  db: {
    runTransaction: mockRunTransaction,
    collectionGroup: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    }),
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        collection: vi.fn(),
      }),
    }),
  },
}));

type AutoInvestModule = typeof import("../../functions/src/jobs/executeAutoInvest");

describe("auto invest helpers", () => {
  let autoInvest: AutoInvestModule;

  beforeAll(async () => {
    autoInvest = await import("../../functions/src/jobs/executeAutoInvest");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolveMarketWindow should prefer KR for 9AM KST and US for 11AM KST", () => {
    const krContext = { runId: "run", scheduledAt: "2025-01-01T00:00:00.000Z" };
    const usContext = { runId: "run", scheduledAt: "2025-01-01T02:00:00.000Z" };
    const fallbackContext = { runId: "run", scheduledAt: "invalid-date" };

    expect(autoInvest.resolveMarketWindow(krContext)).toBe("KR");
    expect(autoInvest.resolveMarketWindow(usContext)).toBe("US");
    expect(autoInvest.resolveMarketWindow(fallbackContext)).toBe("KR");
  });

  it("filterSchedulesByMarket should keep only schedules matching market window", () => {
    const schedules = [
      { market: "KR" },
      { market: "US" },
      { market: "GLOBAL" },
    ] as unknown as Parameters<typeof autoInvest.filterSchedulesByMarket>[0];

    const krFiltered = autoInvest.filterSchedulesByMarket(schedules, "KR");
    const usFiltered = autoInvest.filterSchedulesByMarket(schedules, "US");

    expect(krFiltered.map((s) => s.market)).toEqual(["KR", "GLOBAL"]);
    expect(usFiltered.map((s) => s.market)).toEqual(["US", "GLOBAL"]);
  });

  describe("generateAutoInvestTransactions", () => {
    const baseSchedule = {
      userId: "user1",
      portfolioId: "portfolio1",
      positionId: "position1",
      symbol: "AAPL",
      stockId: "AAPL",
      market: "US",
      currency: "USD",
      positionPath: "users/user1/portfolios/portfolio1/positions/position1",
      autoInvestConfig: {
        startDate: "2023-01-01",
      },
      schedule: {
        id: "schedule1",
        amount: 100,
        currency: "USD" as const,
        effectiveFrom: "2024-01-01",
        effectiveTo: null,
      },
    };

    const context = {
      runId: "run-123",
      scheduledAt: "2025-01-01T02:00:00.000Z",
    };

    it("should skip when schedule amount is invalid", async () => {
      const schedule = {
        ...baseSchedule,
        schedule: { ...baseSchedule.schedule, amount: 0 },
      };

      const result = await autoInvest.generateAutoInvestTransactions(
        schedule,
        context,
        "US"
      );

      expect(result.status).toBe("skipped");
      expect(result.message).toContain("유효하지 않습니다");
    });

    it("should skip when execution date is before effectiveFrom", async () => {
      const schedule = {
        ...baseSchedule,
        schedule: { ...baseSchedule.schedule, effectiveFrom: "2099-01-01" },
      };

      const result = await autoInvest.generateAutoInvestTransactions(
        schedule,
        context,
        "US"
      );

      expect(result.status).toBe("skipped");
      expect(result.message).toContain("효력 시작일");
    });

    it("should skip when execution date is after effectiveTo", async () => {
      const schedule = {
        ...baseSchedule,
        schedule: { ...baseSchedule.schedule, effectiveTo: "2020-12-31" },
      };

      const result = await autoInvest.generateAutoInvestTransactions(
        schedule,
        context,
        "US"
      );

      expect(result.status).toBe("skipped");
      expect(result.message).toContain("스케줄 종료일");
    });

    it("should skip and record alert when balance is insufficient", async () => {
      const getBalanceMock = vi
        .spyOn(autoInvest, "getPortfolioBalance")
        .mockResolvedValue(50);
      const deductMock = vi
        .spyOn(autoInvest, "deductPortfolioBalance")
        .mockResolvedValue({ previous: 100, remaining: 0 });
      const alertMock = vi
        .spyOn(autoInvest, "recordAutomationAlert")
        .mockResolvedValue();

      const result = await autoInvest.generateAutoInvestTransactions(
        baseSchedule,
        context,
        "US"
      );

      expect(result.status).toBe("skipped");
      expect(result.message).toContain("잔액 부족");
      expect(getBalanceMock).toHaveBeenCalledTimes(1);
      expect(deductMock).not.toHaveBeenCalled();
      expect(alertMock).toHaveBeenCalledTimes(1);
    });

    it("should execute and return pending transaction when balance is sufficient", async () => {
      vi.spyOn(autoInvest, "getPortfolioBalance").mockResolvedValue(500);
      const deductMock = vi
        .spyOn(autoInvest, "deductPortfolioBalance")
        .mockResolvedValue({ previous: 500, remaining: 400 });
      const alertMock = vi.spyOn(autoInvest, "recordAutomationAlert");

      const result = await autoInvest.generateAutoInvestTransactions(
        baseSchedule,
        context,
        "US"
      );

      expect(result.status).toBe("executed");
      expect(result.pendingTransactions).toHaveLength(1);
      expect(deductMock).toHaveBeenCalledTimes(1);
      expect(alertMock).not.toHaveBeenCalled();
    });
  });
});

