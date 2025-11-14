import { getPortfolioPositions } from '@/lib/services/position';
import type {
  TaxOptimizationConfig,
  TaxOptimizationPosition,
  TaxOptimizationResponse,
  TaxOptimizationSummary,
} from '@/types';

const DEFAULT_CONFIG: TaxOptimizationConfig = {
  targetHarvestAmount: 500000, // KRW
  estimatedTaxRate: 22, // %
};

function normalizeConfig(config?: Partial<TaxOptimizationConfig>): TaxOptimizationConfig {
  const target =
    typeof config?.targetHarvestAmount === 'number' && Number.isFinite(config.targetHarvestAmount)
      ? Math.max(0, config.targetHarvestAmount)
      : DEFAULT_CONFIG.targetHarvestAmount;

  const taxRate =
    typeof config?.estimatedTaxRate === 'number' && Number.isFinite(config.estimatedTaxRate)
      ? Math.min(Math.max(config.estimatedTaxRate, 0), 60)
      : DEFAULT_CONFIG.estimatedTaxRate;

  return {
    targetHarvestAmount: target,
    estimatedTaxRate: taxRate,
  };
}

function buildSummary(
  target: number,
  harvestAchieved: number,
  totalGains: number,
  totalLosses: number,
  taxRate: number
): TaxOptimizationSummary {
  const estimatedTaxSavings = harvestAchieved * (taxRate / 100);

  return {
    totalUnrealizedGain: totalGains,
    totalUnrealizedLoss: totalLosses,
    netUnrealized: totalGains + totalLosses,
    harvestTarget: target,
    harvestAchieved,
    estimatedTaxSavings,
  };
}

function classifyPositions(
  positions: Awaited<ReturnType<typeof getPortfolioPositions>>,
  targetHarvestAmount: number
): { candidates: TaxOptimizationPosition[]; harvestAchieved: number; totalGain: number; totalLoss: number } {
  const lossPositions = positions
    .filter((position) => position.profitLoss < 0)
    .map((position) => ({
      ...position,
      lossAmount: Math.abs(position.profitLoss),
    }))
    .sort((a, b) => b.lossAmount - a.lossAmount);

  const gainPositions = positions.filter((position) => position.profitLoss > 0);

  let harvestRemaining = targetHarvestAmount;
  let harvestAchieved = 0;

  const candidates: TaxOptimizationPosition[] = [];

  lossPositions.forEach((position) => {
    const harvestAmount = harvestRemaining > 0 ? Math.min(harvestRemaining, Math.abs(position.profitLoss)) : 0;
    if (harvestAmount > 0) {
      harvestAchieved += harvestAmount;
      harvestRemaining -= harvestAmount;
      candidates.push({
        symbol: position.symbol,
        name: position.name,
        currency: position.currency,
        shares: position.shares,
        averagePrice: position.averagePrice,
        currentPrice: position.currentPrice ?? 0,
        totalValue: position.totalValue,
        profitLoss: position.profitLoss,
        returnRate: position.returnRate,
        harvestAmount,
        action: 'harvest-loss',
      });
    } else {
      candidates.push({
        symbol: position.symbol,
        name: position.name,
        currency: position.currency,
        shares: position.shares,
        averagePrice: position.averagePrice,
        currentPrice: position.currentPrice ?? 0,
        totalValue: position.totalValue,
        profitLoss: position.profitLoss,
        returnRate: position.returnRate,
        harvestAmount: 0,
        action: 'monitor',
      });
    }
  });

  gainPositions.forEach((position) => {
    candidates.push({
      symbol: position.symbol,
      name: position.name,
      currency: position.currency,
      shares: position.shares,
      averagePrice: position.averagePrice,
      currentPrice: position.currentPrice ?? 0,
      totalValue: position.totalValue,
      profitLoss: position.profitLoss,
      returnRate: position.returnRate,
      harvestAmount: 0,
      action: 'offset-gain',
    });
  });

  const totalGain = gainPositions.reduce((sum, item) => sum + item.profitLoss, 0);
  const totalLoss = lossPositions.reduce((sum, item) => sum + item.profitLoss, 0);

  return {
    candidates: candidates.sort((a, b) => {
      if (a.action === b.action) {
        return Math.abs(b.profitLoss) - Math.abs(a.profitLoss);
      }
      if (a.action === 'harvest-loss') return -1;
      if (b.action === 'harvest-loss') return 1;
      if (a.action === 'offset-gain') return -1;
      if (b.action === 'offset-gain') return 1;
      return 0;
    }),
    harvestAchieved,
    totalGain,
    totalLoss,
  };
}

export async function getTaxOptimizationPlan(options: {
  userId: string;
  portfolioId: string;
  config?: Partial<TaxOptimizationConfig>;
}): Promise<TaxOptimizationResponse> {
  const { userId, portfolioId, config } = options;
  const normalized = normalizeConfig(config);

  const positions = await getPortfolioPositions(userId, portfolioId);

  const { candidates, harvestAchieved, totalGain, totalLoss } = classifyPositions(
    positions,
    normalized.targetHarvestAmount
  );

  const summary = buildSummary(
    normalized.targetHarvestAmount,
    harvestAchieved,
    totalGain,
    totalLoss,
    normalized.estimatedTaxRate
  );

  return {
    success: true,
    config: normalized,
    summary,
    candidates,
    generatedAt: new Date().toISOString(),
  };
}

