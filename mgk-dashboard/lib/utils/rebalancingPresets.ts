import type { Position, RebalancingPreset } from '@/types';
import { assertCurrency, convertWithRate } from '@/lib/currency';

type BaseCurrency = 'USD' | 'KRW';

const DEFENSIVE_SECTORS = new Set([
  'consumer-staples',
  'utilities',
  'health-care',
  'financials',
  'real-estate',
  'materials',
  'energy',
]);

const GROWTH_SECTORS = new Set([
  'information-technology',
  'communication-services',
  'consumer-discretionary',
]);

interface PreparedPosition {
  symbol: string;
  baseValue: number;
  returnRate: number;
  sector: string | undefined;
  assetType: Position['assetType'];
}

export function buildRebalancingPresets(params: {
  positions: Position[];
  baseCurrency: BaseCurrency;
  exchangeRate?: number | null;
}): RebalancingPreset[] {
  const { positions, baseCurrency, exchangeRate } = params;

  if (!positions.length) {
    return [];
  }

  const prepared = preparePositions(positions, baseCurrency, exchangeRate);
  const totalBaseValue = prepared.reduce((sum, item) => sum + item.baseValue, 0);

  if (totalBaseValue <= 0) {
    return [];
  }

  const presets: RebalancingPreset[] = [];

  // 균등 분산
  presets.push({
    id: 'equal',
    name: '균등 분산',
    description: '모든 종목에 동일한 비중(≈1/N)을 배분합니다.',
    weights: roundWeights(
      prepared.reduce<Record<string, number>>((acc, item) => {
        acc[item.symbol] = 1;
        return acc;
      }, {})
    ),
    meta: { category: 'balanced', riskLevel: 'medium' },
  });

  // 현재 유지
  presets.push({
    id: 'current',
    name: '현재 유지',
    description: '현재 포트폴리오의 비중을 그대로 유지합니다.',
    weights: roundWeights(
      prepared.reduce<Record<string, number>>((acc, item) => {
        acc[item.symbol] = item.baseValue;
        return acc;
      }, {})
    ),
    meta: { category: 'balanced', riskLevel: 'medium', focus: 'status-quo' },
  });

  // 안정형 (Defensive)
  const defensivePreset = buildDefensivePreset(prepared);
  if (defensivePreset) {
    presets.push(defensivePreset);
  }

  // 공격형 (Aggressive)
  const aggressivePreset = buildAggressivePreset(prepared);
  if (aggressivePreset) {
    presets.push(aggressivePreset);
  }

  // AI 추천 (Heuristic)
  presets.push(buildHeuristicPreset(prepared));

  return presets;
}

function preparePositions(
  positions: Position[],
  baseCurrency: BaseCurrency,
  exchangeRate?: number | null
): PreparedPosition[] {
  return positions
    .map((position) => {
      const currency = assertCurrency(
        position.currency,
        position.market === 'KR' ? 'KRW' : 'USD'
      );
      const baseValue = convertToBase(position.totalValue, currency, baseCurrency, exchangeRate);
      return {
        symbol: position.symbol,
        baseValue: Math.max(baseValue, 0),
        returnRate: Number.isFinite(position.returnRate) ? position.returnRate : 0,
        sector: (position as any).sector ?? undefined,
        assetType: position.assetType,
      };
    })
    .filter((item) => item.baseValue > 0);
}

function convertToBase(
  value: number,
  currency: BaseCurrency,
  baseCurrency: BaseCurrency,
  exchangeRate?: number | null
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (currency === baseCurrency) {
    return value;
  }
  if (!exchangeRate || exchangeRate <= 0) {
    return value;
  }
  return baseCurrency === 'USD'
    ? convertWithRate(value, 'KRW', 'USD', exchangeRate)
    : convertWithRate(value, 'USD', 'KRW', exchangeRate);
}

function buildDefensivePreset(prepared: PreparedPosition[]): RebalancingPreset | null {
  const defensive = prepared.filter(
    (item) =>
      DEFENSIVE_SECTORS.has(item.sector ?? '') ||
      item.assetType === 'fund' ||
      item.assetType === 'reit'
  );
  const others = prepared.filter((item) => !defensive.includes(item));

  if (!defensive.length) {
    return null;
  }

  const weights: Record<string, number> = {};
  const defensiveShare = 0.6;
  const otherShare = 0.4;

  distributeGroup(weights, defensive, defensiveShare);
  distributeGroup(weights, others, otherShare);

  return {
    id: 'defensive',
    name: '안정형',
    description: '배당·필수소비재·유틸리티 등 방어형 자산에 60%를 배분합니다.',
    weights: roundWeights(weights),
    meta: { category: 'defensive', riskLevel: 'low', focus: 'stability' },
  };
}

function buildAggressivePreset(prepared: PreparedPosition[]): RebalancingPreset | null {
  const growth = prepared.filter((item) => GROWTH_SECTORS.has(item.sector ?? ''));
  const others = prepared.filter((item) => !growth.includes(item));

  if (!growth.length) {
    return null;
  }

  const weights: Record<string, number> = {};
  const growthShare = 0.7;
  const otherShare = 0.3;

  distributeGroup(weights, growth, growthShare);
  distributeGroup(weights, others, otherShare);

  return {
    id: 'aggressive',
    name: '공격형',
    description: '성장 섹터와 고수익 자산에 70%를 배분하여 수익 극대화를 노립니다.',
    weights: roundWeights(weights),
    meta: { category: 'aggressive', riskLevel: 'high', focus: 'growth' },
  };
}

function buildHeuristicPreset(prepared: PreparedPosition[]): RebalancingPreset {
  const weights: Record<string, number> = {};
  const baseTotal = prepared.reduce((sum, item) => sum + item.baseValue, 0) || 1;
  const averageReturn =
    prepared.reduce((sum, item) => sum + item.returnRate, 0) / prepared.length;

  prepared.forEach((item) => {
    const normalizedBase = item.baseValue / baseTotal;
    let multiplier = 1;

    if (item.returnRate >= 20) multiplier += 0.35;
    else if (item.returnRate >= 10) multiplier += 0.2;
    else if (item.returnRate >= 0) multiplier += 0.05;
    else if (item.returnRate >= -5) multiplier -= 0.05;
    else multiplier -= 0.15;

    if (GROWTH_SECTORS.has(item.sector ?? '')) {
      multiplier += 0.05;
    } else if (DEFENSIVE_SECTORS.has(item.sector ?? '')) {
      multiplier += 0.02;
    }

    // 세이프가드: 지나치게 낮은 비중 방지
    const baseScore = normalizedBase * Math.max(multiplier, 0.1);
    const minFloor = 0.05 / prepared.length;
    weights[item.symbol] = Math.max(baseScore, minFloor);
  });

  const normalized = ensureMinimumWeight(roundWeights(weights), prepared.length >= 6 ? 3 : 5);

  return {
    id: 'ai-recommended',
    name: 'AI 추천',
    description: '최근 성과와 섹터 분산을 반영해 균형 잡힌 목표 비중을 제안합니다.',
    weights: normalized,
    meta: { category: 'ai', riskLevel: 'medium', focus: 'momentum' },
  };
}

function distributeGroup(
  weights: Record<string, number>,
  group: PreparedPosition[],
  share: number
) {
  if (!group.length || share <= 0) {
    return;
  }

  const groupTotal = group.reduce((sum, item) => sum + item.baseValue, 0);
  if (groupTotal <= 0) {
    return;
  }

  group.forEach((item) => {
    const proportion = item.baseValue / groupTotal;
    weights[item.symbol] = (weights[item.symbol] ?? 0) + share * proportion;
  });
}

function roundWeights(weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights).map(([symbol, raw]) => ({
    symbol,
    value: Math.max(raw, 0),
  }));

  const total = entries.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    const equal = 100 / entries.length;
    return entries.reduce<Record<string, number>>((acc, item) => {
      acc[item.symbol] = Math.round(equal * 10) / 10;
      return acc;
    }, {});
  }

  const factor = 10; // 0.1% 단위
  const scaled = entries.map((item) => ({
    symbol: item.symbol,
    scaled: (item.value / total) * 100 * factor,
  }));

  const floored = scaled.map((item) => Math.floor(item.scaled));
  let remainder = Math.round(100 * factor - floored.reduce((sum, val) => sum + val, 0));

  const fractions = scaled
    .map((item, index) => ({
      index,
      fraction: item.scaled - floored[index],
    }))
    .sort((a, b) => b.fraction - a.fraction);

  let fractionIndex = 0;
  while (remainder > 0 && fractions.length > 0) {
    const target = fractions[fractionIndex % fractions.length];
    floored[target.index] += 1;
    remainder -= 1;
    fractionIndex += 1;
  }

  const result: Record<string, number> = {};
  floored.forEach((value, index) => {
    result[scaled[index].symbol] = value / factor;
  });

  return result;
}

function ensureMinimumWeight(
  weights: Record<string, number>,
  minimum: number
): Record<string, number> {
  if (minimum <= 0) {
    return weights;
  }

  const entries = Object.entries(weights);
  const adjusted = entries.map(([symbol, value]) => ({
    symbol,
    value: Math.max(value, minimum),
  }));

  const total = adjusted.reduce((sum, item) => sum + item.value, 0);
  if (total === 100) {
    return Object.fromEntries(adjusted.map((item) => [item.symbol, item.value]));
  }

  // 재정규화
  const normalized = adjusted.reduce<Record<string, number>>((acc, item) => {
    acc[item.symbol] = item.value / total;
    return acc;
  }, {});

  return roundWeights(normalized);
}

