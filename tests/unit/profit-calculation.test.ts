import { describe, expect, it, vi } from "vitest";

vi.mock("../../functions/src/utils/firebase", () => ({
  admin: {
    firestore: {
      FieldValue: {
        serverTimestamp: vi.fn(() => new Date()),
      },
    },
  },
  db: {},
}));

type PositionServiceModule = typeof import("../../mgk-dashboard/lib/services/position");
type CalculationsModule = typeof import("../../mgk-dashboard/lib/utils/calculations");

describe("profit calculation helpers", () => {
  it("calculateReturnRate respects rounding and avoids -0.00%", async () => {
    const calculations = (await import(
      "../../mgk-dashboard/lib/utils/calculations"
    )) as CalculationsModule;

    const cases = [
      { gain: 0.0001, invested: 100, expected: 0 },
      { gain: -0.0001, invested: 100, expected: 0 },
      { gain: 5, invested: 100, expected: 5 },
      { gain: -5, invested: 100, expected: -5 },
    ];

    cases.forEach(({ gain, invested, expected }) => {
      const actual = calculations.calculateReturnRate(gain, invested, 2);
      expect(actual).toBeCloseTo(expected, 2);
    });
  });

  it("resolveInvestedValue sums executed transactions using totalInvested", async () => {
    const positionService = (await import(
      "../../mgk-dashboard/lib/services/position"
    )) as PositionServiceModule;

    const transactions: Parameters<
      typeof positionService.resolveInvestedValue
    >[0] = [
      {
        id: "t1",
        type: "buy",
        amount: 100,
        totalAmount: 100,
        shares: 1,
        fee: 0,
        tax: 0,
        status: "completed",
      },
      {
        id: "t2",
        type: "buy",
        amount: 50,
        totalAmount: 55,
        shares: 0.5,
        fee: 5,
        tax: 0,
        status: "completed",
      },
      {
        id: "t3",
        type: "buy",
        amount: 30,
        totalAmount: 30,
        shares: 0.3,
        fee: 0,
        tax: 0,
        status: "pending",
      },
      {
        id: "t4",
        type: "sell",
        amount: 20,
        totalAmount: 20,
        shares: 0.2,
        fee: 0,
        tax: 0,
        status: "completed",
      },
    ];

    const invested = positionService.resolveInvestedValue(transactions);
    expect(invested.totalInvested).toBeCloseTo(155); // executed buys only: 100 + 55
    expect(invested.executedShares).toBeCloseTo(1.5);
  });

  it("applyLatestMarketPrices computes profitLoss using totalInvested", async () => {
    const positionService = (await import(
      "../../mgk-dashboard/lib/services/position"
    )) as PositionServiceModule;

    const position = {
      id: "pos1",
      symbol: "AAPL",
      shares: 1.5,
      market: "US",
      currency: "USD",
      totalInvested: 155,
      averagePrice: 103.3333,
      transactions: [],
    };

    const marketPrices = {
      AAPL: {
        price: 120,
        timestamp: new Date().toISOString(),
        source: "live",
      },
    };

    const result = positionService.applyLatestMarketPrices(
      [position as any],
      marketPrices
    );

    expect(result[0].currentValue).toBeCloseTo(180);
    expect(result[0].profitLoss).toBeCloseTo(25);
    expect(result[0].returnRate).toBeCloseTo(16.13, 2);
  });
});

