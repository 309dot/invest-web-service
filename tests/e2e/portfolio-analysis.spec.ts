import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const portfolioId = process.env.E2E_PORTFOLIO_ID ?? "demo-portfolio";
const firebaseApiKey =
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "test-api-key";

const analysisFixture = {
  success: true,
  analysis: {
    portfolioId,
    totalValue: 250_000,
    totalInvested: 200_000,
    overallReturnRate: 25.0,
    baseCurrency: "USD",
    exchangeRate: {
      base: "USD",
      quote: "KRW",
      rate: 1320.12,
      source: "cache",
    },
    currencyTotals: {
      USD: {
        originalValue: 150_000,
        originalInvested: 120_000,
        convertedValue: 150_000,
        convertedInvested: 120_000,
        count: 4,
      },
      KRW: {
        originalValue: 100_000,
        originalInvested: 80_000,
        convertedValue: 100_000,
        convertedInvested: 80_000,
        count: 3,
      },
    },
    sectorAllocation: [
      {
        sector: "Information Technology",
        value: 70_000,
        percentage: 28,
        returnRate: 12,
      },
      {
        sector: "Financials",
        value: 40_000,
        percentage: 16,
        returnRate: 7,
      },
    ],
    regionAllocation: [
      { market: "US", value: 180_000, percentage: 72, returnRate: 18 },
      { market: "KR", value: 70_000, percentage: 28, returnRate: 9 },
    ],
    assetAllocation: [
      { assetType: "stock", value: 220_000, percentage: 88, returnRate: 20 },
      { assetType: "etf", value: 30_000, percentage: 12, returnRate: 6 },
    ],
    benchmarkComparison: [
      {
        id: "snp500",
        name: "S&P 500",
        symbol: "^GSPC",
        currency: "USD",
        returnRate: 22,
        since: "2024-01-01",
        source: "yahoo",
      },
      {
        id: "kospi",
        name: "KOSPI",
        symbol: "^KS11",
        currency: "KRW",
        returnRate: 15,
        since: "2024-01-01",
        source: "yahoo",
      },
    ],
    riskMetrics: {
      volatility: 12,
      sharpeRatio: 1.2,
      maxDrawdown: -8,
      beta: 0.9,
    },
    topContributors: [
      { symbol: "AAPL", contribution: 5.5, returnRate: 18 },
      { symbol: "TSLA", contribution: 3.2, returnRate: 22 },
    ],
    rebalancingSuggestions: [
      {
        symbol: "AAPL",
        currentPercentage: 20,
        targetPercentage: 18,
        action: "sell",
        amount: 2000,
      },
      {
        symbol: "BND",
        currentPercentage: 5,
        targetPercentage: 10,
        action: "buy",
        amount: 5000,
      },
    ],
    diversificationScore: 78,
    timestamp: new Date().toISOString(),
  },
  positions: [
    {
      id: "pos1",
      portfolioId,
      stockId: "AAPL",
      symbol: "AAPL",
      name: "Apple Inc.",
      market: "US",
      exchange: "NASDAQ",
      assetType: "stock",
      currency: "USD",
      shares: 50,
      averagePrice: 160,
      totalInvested: 8000,
      currentPrice: 180,
      totalValue: 9000,
      returnRate: 12.5,
      profitLoss: 1000,
      priceSource: "live",
      priceTimestamp: new Date().toISOString(),
      purchaseMethod: "auto",
      firstPurchaseDate: "2021-01-15",
      lastTransactionDate: "2024-11-30",
      transactionCount: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "pos2",
      portfolioId,
      stockId: "VOO",
      symbol: "VOO",
      name: "Vanguard S&P 500 ETF",
      market: "US",
      exchange: "NYSE",
      assetType: "etf",
      currency: "USD",
      shares: 20,
      averagePrice: 400,
      totalInvested: 8000,
      currentPrice: 415,
      totalValue: 8300,
      returnRate: 3.75,
      profitLoss: 300,
      priceSource: "cached",
      priceTimestamp: new Date().toISOString(),
      purchaseMethod: "manual",
      firstPurchaseDate: "2020-07-01",
      lastTransactionDate: "2024-10-05",
      transactionCount: 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  performance: [
    {
      id: "1M",
      label: "1개월",
      startDate: "2024-11-01",
      endDate: "2024-12-01",
      periodDays: 30,
      sampleCount: 30,
      startValue: 200_000,
      endValue: 210_000,
      absoluteReturn: 10_000,
      totalReturn: 5,
      annualizedReturn: 60,
      startInvested: 180_000,
      endInvested: 190_000,
      investedChange: 10_000,
      source: "mock",
      cumulativeGain: 12_000,
      cumulativeLoss: -2000,
      bestDayReturn: 3,
      worstDayReturn: -2,
      volatility: 10,
      sharpeRatio: 1.1,
      maxDrawdown: -4,
      note: "mock-data",
    },
  ],
};

const contributionFixture = {
  success: true,
  period: "1m",
  baseCurrency: "USD",
  entries: [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      market: "US",
      currency: "USD",
      weightPct: 20,
      returnPct: 12,
      contributionPct: 4.5,
      contributionValue: 4500,
      investmentValue: 8000,
      currentValue: 9000,
      averagePrice: 160,
      currentPrice: 180,
      transactions: 12,
      isTopContributor: true,
      isLagging: false,
    },
  ],
  totals: {
    totalContributionValue: 4500,
    totalContributionPct: 4.5,
    totalInvested: 8000,
    totalValue: 9000,
  },
  generatedAt: new Date().toISOString(),
};

const comparisonFixture = {
  success: true,
  period: "1m",
  baseCurrency: "USD",
  includeBenchmarks: true,
  series: [
    {
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      market: "US",
      isBenchmark: false,
      basePrice: 150,
      latestPrice: 180,
      latestReturnPct: 20,
      data: [
        { date: "2024-11-01", price: 150, returnPct: 0 },
        { date: "2024-12-01", price: 180, returnPct: 20 },
      ],
      metrics: {
        totalReturnPct: 20,
        annualizedReturnPct: 240,
        volatilityPct: 15,
        sharpe: 1.4,
        maxDrawdownPct: -4,
        bestDayPct: 3,
        worstDayPct: -1,
        tradingDays: 30,
        startPrice: 150,
        endPrice: 180,
      },
    },
  ],
  generatedAt: new Date().toISOString(),
};

const correlationFixture = {
  success: true,
  period: "1m",
  baseCurrency: "USD",
  symbols: [
    { symbol: "AAPL", name: "Apple Inc.", currency: "USD" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", currency: "USD" },
  ],
  matrix: [
    [1, 0.72],
    [0.72, 1],
  ],
  generatedAt: new Date().toISOString(),
};

const scenarioFixture = {
  success: true,
  config: {
    preset: "bullish",
    marketShiftPct: 5,
    usdShiftPct: 1.5,
    additionalContribution: 0,
    notes: "",
  },
  result: {
    currentTotalValue: 250_000,
    projectedTotalValue: 265_000,
    projectedReturnRate: 6,
    projectedProfitLoss: 15_000,
    additionalContribution: 0,
    marketShiftPct: 5,
    usdShiftPct: 1.5,
    positions: [
      {
        symbol: "AAPL",
        currency: "USD",
        shares: 50,
        currentPrice: 180,
        projectedPrice: 189,
        currentValue: 9000,
        projectedValue: 9450,
        projectedProfitLoss: 450,
        projectedReturnRate: 5,
      },
    ],
  },
  generatedAt: new Date().toISOString(),
};

const taxFixture = {
  success: true,
  config: {
    targetHarvestAmount: 5000,
    estimatedTaxRate: 15,
  },
  summary: {
    totalUnrealizedGain: 18_000,
    totalUnrealizedLoss: -2000,
    netUnrealized: 16_000,
    harvestTarget: 5000,
    harvestAchieved: 3500,
    estimatedTaxSavings: 525,
  },
  candidates: [
    {
      symbol: "TSLA",
      currency: "USD",
      shares: 12,
      averagePrice: 300,
      currentPrice: 280,
      totalValue: 3360,
      profitLoss: -240,
      returnRate: -7.1,
      harvestAmount: 240,
      action: "harvest-loss",
    },
  ],
  generatedAt: new Date().toISOString(),
};

const personalizedFixture = {
  success: true,
  settings: {
    riskProfile: "balanced",
    investmentGoal: "growth",
    focusAreas: ["diversification", "tax-efficiency"],
    lastUpdated: new Date().toISOString(),
  },
  marketMode: "bullish",
  baseCurrency: "USD",
  hero: {
    headline: "균형 잡힌 성장",
    subheading: "시장 상승 흐름에 맞춰 포트폴리오가 고르게 성장 중입니다.",
    mood: "positive",
    metrics: [
      { id: "totalValue", label: "총 평가액", value: 250_000, type: "currency", currency: "USD" },
      { id: "returnRate", label: "총 수익률", value: 25, type: "percent", emphasis: "positive" },
    ],
  },
  metrics: [
    { id: "safetyBuffer", label: "현금 비중", value: 12, type: "percent", emphasis: "neutral" },
    { id: "riskScore", label: "위험 점수", value: 45, type: "score", emphasis: "neutral" },
  ],
  actions: [
    {
      id: "rebalance-1",
      title: "채권 비중 확대",
      summary: "시장 변동성 대비 방어 목적 채권 추가 매수 권장",
      severity: "important",
      source: "rebalancing",
      createdAt: new Date().toISOString(),
    },
  ],
  recommendedWidgets: ["benchmark", "scenario", "tax-optimization"],
  updatedAt: new Date().toISOString(),
};

async function mockAuthSession(page: any) {
  await page.addInitScript(
    ({ apiKey, user }) => {
      const storageKey = `firebase:authUser:${apiKey}:[DEFAULT]`;
      window.localStorage.setItem(storageKey, JSON.stringify(user));
      window.localStorage.setItem(`${storageKey}-persist`, "local");
    },
    {
      apiKey: firebaseApiKey,
      user: {
        uid: "e2e-user",
        email: "e2e@example.com",
        displayName: "E2E User",
        stsTokenManager: {
          accessToken: "test-token",
          refreshToken: "test-refresh",
          expirationTime: Date.now() + 60 * 60 * 1000,
        },
        providerData: [],
      },
    }
  );
}

async function setupApiMocks(page: any) {
  await page.route("**/api/portfolio/analysis**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(analysisFixture),
    })
  );

  await page.route("**/api/portfolio/contribution**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(contributionFixture),
    })
  );

  await page.route("**/api/portfolio/comparison**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(comparisonFixture),
    })
  );

  await page.route("**/api/portfolio/correlation**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(correlationFixture),
    })
  );

  await page.route("**/api/portfolio/scenario", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(scenarioFixture),
    })
  );

  await page.route("**/api/portfolio/tax-optimization", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(taxFixture),
    })
  );

  await page.route("**/api/dashboard/personalized**", (route: any) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(personalizedFixture),
    })
  );
}

test.describe("Portfolio analysis e2e flow", () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page);
    await setupApiMocks(page);
    await page.goto(
      `${baseURL}/portfolio/analysis?portfolioId=${encodeURIComponent(portfolioId)}`
    );
  });

  test("renders core analysis widgets and personalized dashboard", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "거래 타임라인 요약" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "벤치마크 비교" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "기간별 성과" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI 실행 항목" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "시나리오 분석" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "세금 최적화" })
    ).toBeVisible();

    await expect(page.getByText("균형 잡힌 성장")).toBeVisible();
    await expect(page.getByText("CSV 내보내기")).toBeEnabled();
  });

  test("allows running scenario analysis with mocked response", async ({ page }) => {
    const runButton = page.getByRole("button", { name: "시뮬레이션 실행" });
    await runButton.click();

    await expect(page.getByText("현재 평가액")).toBeVisible();
    await expect(page.getByText("시나리오 평가액")).toBeVisible();
    await expect(page.getByText("예상 손익")).toBeVisible();
    await expect(page.getByText("예상 수익률")).toBeVisible();
  });
});

