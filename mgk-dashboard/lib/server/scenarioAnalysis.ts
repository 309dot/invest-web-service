import { getPortfolioPositions } from '@/lib/services/position';
import type {
  ScenarioAnalysisResponse,
  ScenarioConfig,
  ScenarioPositionProjection,
  ScenarioPreset,
} from '@/types';

interface ScenarioOptions extends ScenarioConfig {
  userId: string;
  portfolioId: string;
}

const PRESET_DEFAULTS: Record<ScenarioPreset, Pick<ScenarioConfig, 'marketShiftPct' | 'usdShiftPct'>> = {
  bullish: { marketShiftPct: 5, usdShiftPct: 1.5 },
  bearish: { marketShiftPct: -5, usdShiftPct: -1 },
  volatile: { marketShiftPct: 0, usdShiftPct: 3 },
  custom: { marketShiftPct: 0, usdShiftPct: 0 },
};

function applyPreset(config: ScenarioConfig): ScenarioConfig {
  if (config.preset === 'custom') {
    return config;
  }
  const defaults = PRESET_DEFAULTS[config.preset];
  return {
    ...config,
    marketShiftPct: config.marketShiftPct ?? defaults.marketShiftPct,
    usdShiftPct: config.usdShiftPct ?? defaults.usdShiftPct,
  };
}

function projectPosition(params: {
  symbol: string;
  name?: string;
  currency: 'USD' | 'KRW';
  shares: number;
  currentPrice: number;
  marketShiftPct: number;
  usdShiftPct: number;
}): ScenarioPositionProjection {
  const { symbol, name, currency, shares, currentPrice, marketShiftPct, usdShiftPct } = params;
  const priceMultiplier = 1 + marketShiftPct / 100;
  const currencyMultiplier = currency === 'USD' ? 1 + usdShiftPct / 100 : 1;
  const projectedPrice = currentPrice * priceMultiplier * currencyMultiplier;
  const currentValue = shares * currentPrice;
  const projectedValue = shares * projectedPrice;
  const projectedProfitLoss = projectedValue - currentValue;
  const projectedReturnRate = currentValue > 0 ? (projectedProfitLoss / currentValue) * 100 : 0;

  return {
    symbol,
    name,
    currency,
    shares,
    currentPrice,
    projectedPrice,
    currentValue,
    projectedValue,
    projectedProfitLoss,
    projectedReturnRate,
  };
}

export async function runScenarioAnalysis(options: ScenarioOptions): Promise<ScenarioAnalysisResponse> {
  const { userId, portfolioId } = options;
  const normalizedConfig = applyPreset({
    preset: options.preset,
    marketShiftPct: options.marketShiftPct,
    usdShiftPct: options.usdShiftPct,
    additionalContribution: options.additionalContribution,
    notes: options.notes,
  });

  const positions = await getPortfolioPositions(userId, portfolioId);

  let currentTotalValue = 0;
  const projections: ScenarioPositionProjection[] = positions.map((position) => {
    const projection = projectPosition({
      symbol: position.symbol,
      name: position.name,
      currency: position.currency,
      shares: position.shares,
      currentPrice: position.currentPrice ?? 0,
      marketShiftPct: normalizedConfig.marketShiftPct,
      usdShiftPct: normalizedConfig.usdShiftPct,
    });
    currentTotalValue += projection.currentValue;
    return projection;
  });

  const projectedPortfolioValue =
    projections.reduce((sum, item) => sum + item.projectedValue, 0) +
    normalizedConfig.additionalContribution;

  const projectedProfitLoss = projectedPortfolioValue - currentTotalValue;
  const projectedReturnRate =
    currentTotalValue > 0 ? (projectedProfitLoss / currentTotalValue) * 100 : 0;

  return {
    success: true,
    config: normalizedConfig,
    result: {
      currentTotalValue,
      projectedTotalValue: projectedPortfolioValue,
      projectedReturnRate,
      projectedProfitLoss,
      additionalContribution: normalizedConfig.additionalContribution,
      marketShiftPct: normalizedConfig.marketShiftPct,
      usdShiftPct: normalizedConfig.usdShiftPct,
      positions: projections.sort((a, b) => b.projectedProfitLoss - a.projectedProfitLoss),
    },
    generatedAt: new Date().toISOString(),
  };
}

