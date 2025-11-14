import { analyzePortfolio } from '@/lib/services/portfolio-analysis';
import { getPortfolioPositions } from '@/lib/services/position';
import { generateRebalancingSuggestions } from '@/lib/services/portfolio-analysis';
import type {
  OptimizerAction,
  OptimizerRecommendation,
  PortfolioOptimizerResponse,
  Position,
} from '@/types';

interface BuildRecommendationParams {
  id: string;
  name: string;
  summary: string;
  rationale: string[];
  targetWeights: Record<string, number>;
  positions: Position[];
  currentWeights: Record<string, number>;
  totalValue: number;
  exchangeRate: number | null;
}

function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!entries.length) {
    return {};
  }
  const sum = entries.reduce((acc, [, value]) => acc + value, 0);
  if (sum <= 0) {
    return {};
  }
  const normalized: Record<string, number> = {};
  entries.forEach(([symbol, value]) => {
    normalized[symbol] = parseFloat(((value / sum) * 100).toFixed(2));
  });

  // Rebalance rounding to ensure sum 100
  const diff = 100 - Object.values(normalized).reduce((acc, value) => acc + value, 0);
  if (Math.abs(diff) >= 0.1) {
    const [firstSymbol] = Object.keys(normalized);
    normalized[firstSymbol] = parseFloat((normalized[firstSymbol] + diff).toFixed(2));
  }

  return normalized;
}

function computeScores(
  positions: Position[],
  scoreFn: (position: Position) => number
): Record<string, number> {
  const scores: Record<string, number> = {};
  positions.forEach((position) => {
    const value = Math.max(0, scoreFn(position));
    if (value > 0) {
      scores[position.symbol] = value;
    }
  });
  return scores;
}

function weightByPerformance(positions: Position[]): Record<string, number> {
  return computeScores(positions, (position) => Math.max(0.1, position.returnRate + 5));
}

function weightByRiskAdjusted(positions: Position[]): Record<string, number> {
  return computeScores(positions, (position) => {
    const base = Math.max(0.1, position.returnRate + 10);
    const riskPenalty = Math.max(1, Math.abs(position.returnRate) / 10 + 1);
    const typeModifier =
      position.assetType === 'etf' || position.assetType === 'fund' || position.assetType === 'reit' ? 1.2 : 1;
    return base / riskPenalty * typeModifier;
  });
}

function weightByDiversification(positions: Position[]): Record<string, number> {
  const sectorCounts: Record<string, number> = {};
  positions.forEach((position) => {
    const sector = position.sector ?? 'other';
    sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1;
  });

  return computeScores(positions, (position) => {
    const sector = position.sector ?? 'other';
    const sectorWeight = 1 / (sectorCounts[sector] ?? 1);
    const base = position.totalValue > 0 ? position.totalValue : 0.1;
    return base * sectorWeight;
  });
}

function buildRecommendation(params: BuildRecommendationParams): OptimizerRecommendation {
  const {
    id,
    name,
    summary,
    rationale,
    targetWeights,
    positions,
    currentWeights,
    totalValue,
    exchangeRate,
  } = params;

  const suggestions = generateRebalancingSuggestions(positions, {
    targetAllocation: targetWeights,
    baseTotalValue: totalValue,
    exchangeRate,
  });

  const positionMap = new Map(positions.map((position) => [position.symbol, position]));

  const actions: OptimizerAction[] = suggestions.map((suggestion) => {
    const position = positionMap.get(suggestion.symbol);
    const targetWeight = targetWeights[suggestion.symbol] ?? 0;
    const currentWeight = currentWeights[suggestion.symbol] ?? 0;
    return {
      symbol: suggestion.symbol,
      action: suggestion.action,
      weightDelta: parseFloat((targetWeight - currentWeight).toFixed(2)),
      amountBase: parseFloat(suggestion.baseAmount.toFixed(2)),
      rationale: suggestion.reason,
    };
  });

  const expectedReturn = Object.entries(targetWeights).reduce((acc, [symbol, weight]) => {
    const position = positionMap.get(symbol);
    if (!position) {
      return acc;
    }
    return acc + (weight / 100) * (position.returnRate ?? 0);
  }, 0);

  const expectedRisk = Object.entries(targetWeights).reduce((acc, [symbol, weight]) => {
    const position = positionMap.get(symbol);
    if (!position) {
      return acc;
    }
    return acc + (weight / 100) * Math.max(5, Math.abs(position.returnRate ?? 0));
  }, 0);

  return {
    id,
    name,
    summary,
    rationale,
    targetWeights,
    expectedReturn: parseFloat(expectedReturn.toFixed(2)),
    expectedRisk: parseFloat(expectedRisk.toFixed(2)),
    rebalancing: actions,
  };
}

export async function runPortfolioOptimization(params: {
  userId: string;
  portfolioId: string;
}): Promise<PortfolioOptimizerResponse> {
  const { userId, portfolioId } = params;

  const [analysis, positions] = await Promise.all([
    analyzePortfolio(userId, portfolioId),
    getPortfolioPositions(userId, portfolioId),
  ]);

  const filteredPositions = positions.filter((position) => position.totalValue > 0);
  const totalValue = filteredPositions.reduce((sum, position) => sum + position.totalValue, 0);

  if (!filteredPositions.length || totalValue <= 0) {
    return {
      success: true,
      baseCurrency: analysis.baseCurrency,
      currentWeights: {},
      recommendations: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const currentWeights: Record<string, number> = {};
  filteredPositions.forEach((position) => {
    currentWeights[position.symbol] = parseFloat(((position.totalValue / totalValue) * 100).toFixed(2));
  });

  const equalWeights = normalizeWeights(
    filteredPositions.reduce<Record<string, number>>((acc, position) => {
      acc[position.symbol] = 1;
      return acc;
    }, {})
  );

  const growthWeights = normalizeWeights(weightByPerformance(filteredPositions));
  const defensiveWeights = normalizeWeights(weightByRiskAdjusted(filteredPositions));
  const diversifiedWeights = normalizeWeights(weightByDiversification(filteredPositions));

  const recommendations: OptimizerRecommendation[] = [];

  if (Object.keys(equalWeights).length) {
    recommendations.push(
      buildRecommendation({
        id: 'equal-balance',
        name: '균등 분산',
        summary: '모든 종목에 동일한 비중을 부여해 편중을 줄입니다.',
        rationale: ['과도한 집중을 줄이고, 리밸런싱 시점 파악이 쉬워집니다.'],
        targetWeights: equalWeights,
        positions: filteredPositions,
        currentWeights,
        totalValue,
        exchangeRate: analysis.exchangeRate?.rate ?? null,
      })
    );
  }

  if (Object.keys(growthWeights).length) {
    recommendations.push(
      buildRecommendation({
        id: 'growth-focus',
        name: '성장 지향',
        summary: '최근 성과가 좋은 자산 비중을 확대한 전략입니다.',
        rationale: [
          '수익률이 높은 종목에 더 많은 비중을 투자해 모멘텀을 활용합니다.',
          '성과 기반으로 자동 가중치를 계산했습니다.',
        ],
        targetWeights: growthWeights,
        positions: filteredPositions,
        currentWeights,
        totalValue,
        exchangeRate: analysis.exchangeRate?.rate ?? null,
      })
    );
  }

  if (Object.keys(defensiveWeights).length) {
    recommendations.push(
      buildRecommendation({
        id: 'defensive-shield',
        name: '방어형',
        summary: '변동성이 높은 자산의 비중을 줄여 하방 위험을 낮추는 전략입니다.',
        rationale: [
          '수익률 대비 변동성을 고려해 안정적인 자산에 가중치를 부여했습니다.',
          'ETF·REIT 비중을 높여 시장 하락 시 방어력을 강화합니다.',
        ],
        targetWeights: defensiveWeights,
        positions: filteredPositions,
        currentWeights,
        totalValue,
        exchangeRate: analysis.exchangeRate?.rate ?? null,
      })
    );
  }

  if (Object.keys(diversifiedWeights).length) {
    recommendations.push(
      buildRecommendation({
        id: 'diversified-mix',
        name: '다각화 강화',
        summary: '섹터·지역 편중도를 완화해 장기 리스크를 낮추는 전략입니다.',
        rationale: [
          '섹터별 비중을 균등화해 특정 산업 의존도를 줄입니다.',
          '집중된 종목을 일부 매도하고 부족한 섹터를 채웁니다.',
        ],
        targetWeights: diversifiedWeights,
        positions: filteredPositions,
        currentWeights,
        totalValue,
        exchangeRate: analysis.exchangeRate?.rate ?? null,
      })
    );
  }

  return {
    success: true,
    baseCurrency: analysis.baseCurrency,
    currentWeights,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

