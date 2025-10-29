/**
 * 포트폴리오 분석 서비스
 * 
 * 섹터/지역별 분산도, 리스크 분석, 리밸런싱 제안
 */

import { getPortfolioPositions } from './position';
import type { Position, Sector, Market, AssetType } from '@/types';

export interface SectorAllocation {
  sector: Sector | 'unknown';
  value: number;
  percentage: number;
  returnRate: number;
  count: number;
}

export interface RegionAllocation {
  region: Market;
  value: number;
  percentage: number;
  returnRate: number;
  count: number;
}

export interface AssetAllocation {
  assetType: AssetType;
  value: number;
  percentage: number;
  returnRate: number;
  count: number;
}

export interface RiskMetrics {
  volatility: number; // 변동성 (표준편차)
  sharpeRatio: number; // 샤프 비율
  maxDrawdown: number; // 최대 낙폭
  concentration: number; // 집중도 (HHI)
}

export interface TopContributor {
  symbol: string;
  contribution: number; // 수익 기여도
  weight: number; // 비중
  returnRate: number;
}

export interface RebalancingSuggestion {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  action: 'buy' | 'sell' | 'hold';
  amount: number;
  reason: string;
}

export interface PortfolioAnalysis {
  portfolioId: string;
  totalValue: number;
  totalInvested: number;
  overallReturnRate: number;
  sectorAllocation: SectorAllocation[];
  regionAllocation: RegionAllocation[];
  assetAllocation: AssetAllocation[];
  riskMetrics: RiskMetrics;
  topContributors: TopContributor[];
  rebalancingSuggestions: RebalancingSuggestion[];
  diversificationScore: number; // 0-100
  timestamp: string;
}

/**
 * 섹터별 분산도 계산
 */
export function calculateSectorAllocation(
  positions: Position[]
): SectorAllocation[] {
  const sectorMap = new Map<Sector | 'unknown', {
    value: number;
    invested: number;
    count: number;
  }>();

  positions.forEach((position) => {
    const sector = (position as any).sector || 'unknown';
    const existing = sectorMap.get(sector) || { value: 0, invested: 0, count: 0 };
    
    sectorMap.set(sector, {
      value: existing.value + position.totalValue,
      invested: existing.invested + position.totalInvested,
      count: existing.count + 1,
    });
  });

  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);

  const allocations: SectorAllocation[] = [];
  sectorMap.forEach((data, sector) => {
    const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
    const returnRate = data.invested > 0 
      ? ((data.value - data.invested) / data.invested) * 100 
      : 0;

    allocations.push({
      sector,
      value: data.value,
      percentage,
      returnRate,
      count: data.count,
    });
  });

  return allocations.sort((a, b) => b.value - a.value);
}

/**
 * 지역별 분산도 계산
 */
export function calculateRegionAllocation(
  positions: Position[]
): RegionAllocation[] {
  const regionMap = new Map<Market, {
    value: number;
    invested: number;
    count: number;
  }>();

  positions.forEach((position) => {
    // 심볼 기반 지역 판단 (간단한 로직)
    const market: Market = position.symbol.match(/^[0-9]/) ? 'KR' : 'US';
    const existing = regionMap.get(market) || { value: 0, invested: 0, count: 0 };
    
    regionMap.set(market, {
      value: existing.value + position.totalValue,
      invested: existing.invested + position.totalInvested,
      count: existing.count + 1,
    });
  });

  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);

  const allocations: RegionAllocation[] = [];
  regionMap.forEach((data, region) => {
    const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
    const returnRate = data.invested > 0 
      ? ((data.value - data.invested) / data.invested) * 100 
      : 0;

    allocations.push({
      region,
      value: data.value,
      percentage,
      returnRate,
      count: data.count,
    });
  });

  return allocations.sort((a, b) => b.value - a.value);
}

/**
 * 자산 유형별 분산도 계산
 */
export function calculateAssetAllocation(
  positions: Position[]
): AssetAllocation[] {
  const assetMap = new Map<AssetType, {
    value: number;
    invested: number;
    count: number;
  }>();

  positions.forEach((position) => {
    // 기본값: stock (향후 종목 마스터에서 가져와야 함)
    const assetType: AssetType = (position as any).assetType || 'stock';
    const existing = assetMap.get(assetType) || { value: 0, invested: 0, count: 0 };
    
    assetMap.set(assetType, {
      value: existing.value + position.totalValue,
      invested: existing.invested + position.totalInvested,
      count: existing.count + 1,
    });
  });

  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);

  const allocations: AssetAllocation[] = [];
  assetMap.forEach((data, assetType) => {
    const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
    const returnRate = data.invested > 0 
      ? ((data.value - data.invested) / data.invested) * 100 
      : 0;

    allocations.push({
      assetType,
      value: data.value,
      percentage,
      returnRate,
      count: data.count,
    });
  });

  return allocations.sort((a, b) => b.value - a.value);
}

/**
 * 리스크 지표 계산
 */
export function calculateRiskMetrics(
  positions: Position[]
): RiskMetrics {
  if (positions.length === 0) {
    return {
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      concentration: 0,
    };
  }

  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
  
  // 1. 변동성 (수익률의 표준편차)
  const returnRates = positions.map(p => p.returnRate);
  const avgReturn = returnRates.reduce((sum, r) => sum + r, 0) / returnRates.length;
  const variance = returnRates.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returnRates.length;
  const volatility = Math.sqrt(variance);

  // 2. 샤프 비율 (간단 버전: 위험 프리 이자율 0% 가정)
  const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

  // 3. 최대 낙폭 (현재는 각 포지션의 최대 손실)
  const maxDrawdown = Math.min(
    ...positions.map(p => p.returnRate < 0 ? p.returnRate : 0)
  );

  // 4. 집중도 (Herfindahl-Hirschman Index)
  const weights = positions.map(p => totalValue > 0 ? p.totalValue / totalValue : 0);
  const concentration = weights.reduce((sum, w) => sum + Math.pow(w * 100, 2), 0);

  return {
    volatility: Math.abs(volatility),
    sharpeRatio,
    maxDrawdown: Math.abs(maxDrawdown),
    concentration,
  };
}

/**
 * 상위 수익 기여자 계산
 */
export function calculateTopContributors(
  positions: Position[],
  limit: number = 5
): TopContributor[] {
  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
  
  const contributors: TopContributor[] = positions.map((position) => ({
    symbol: position.symbol,
    contribution: position.profitLoss,
    weight: totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0,
    returnRate: position.returnRate,
  }));

  return contributors
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, limit);
}

/**
 * 다각화 점수 계산 (0-100)
 */
export function calculateDiversificationScore(
  sectorAllocation: SectorAllocation[],
  regionAllocation: RegionAllocation[],
  assetAllocation: AssetAllocation[],
  positionCount: number
): number {
  let score = 0;

  // 1. 종목 수 (최대 30점)
  if (positionCount >= 20) score += 30;
  else if (positionCount >= 15) score += 25;
  else if (positionCount >= 10) score += 20;
  else if (positionCount >= 5) score += 15;
  else score += positionCount * 3;

  // 2. 섹터 분산 (최대 30점)
  const sectorCount = sectorAllocation.length;
  const maxSectorWeight = Math.max(...sectorAllocation.map(s => s.percentage));
  if (sectorCount >= 8) score += 15;
  else if (sectorCount >= 5) score += 10;
  else score += sectorCount * 2;
  
  if (maxSectorWeight < 30) score += 15;
  else if (maxSectorWeight < 40) score += 10;
  else if (maxSectorWeight < 50) score += 5;

  // 3. 지역 분산 (최대 20점)
  const regionCount = regionAllocation.length;
  const maxRegionWeight = Math.max(...regionAllocation.map(r => r.percentage));
  if (regionCount >= 3) score += 10;
  else score += regionCount * 3;
  
  if (maxRegionWeight < 60) score += 10;
  else if (maxRegionWeight < 70) score += 7;
  else if (maxRegionWeight < 80) score += 5;

  // 4. 자산 유형 분산 (최대 20점)
  const assetCount = assetAllocation.length;
  const maxAssetWeight = Math.max(...assetAllocation.map(a => a.percentage));
  if (assetCount >= 3) score += 10;
  else score += assetCount * 3;
  
  if (maxAssetWeight < 70) score += 10;
  else if (maxAssetWeight < 80) score += 7;
  else if (maxAssetWeight < 90) score += 5;

  return Math.min(100, Math.max(0, score));
}

/**
 * 리밸런싱 제안 생성
 */
export function generateRebalancingSuggestions(
  positions: Position[],
  targetAllocation?: Record<string, number> // 목표 비중
): RebalancingSuggestion[] {
  if (positions.length === 0) return [];

  const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
  const suggestions: RebalancingSuggestion[] = [];

  // 목표 비중이 없으면 균등 분배
  const defaultTarget = 100 / positions.length;

  positions.forEach((position) => {
    const currentWeight = totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0;
    const targetWeight = targetAllocation?.[position.symbol] || defaultTarget;
    const difference = currentWeight - targetWeight;

    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let reason = '';

    if (Math.abs(difference) < 2) {
      reason = '목표 비중과 근접';
    } else if (difference > 0) {
      action = 'sell';
      reason = `목표 비중 초과 (${Math.abs(difference).toFixed(1)}%)`;
    } else {
      action = 'buy';
      reason = `목표 비중 미달 (${Math.abs(difference).toFixed(1)}%)`;
    }

    const amount = Math.abs((totalValue * difference) / 100);

    suggestions.push({
      symbol: position.symbol,
      currentWeight,
      targetWeight,
      action,
      amount,
      reason,
    });
  });

  return suggestions
    .filter(s => s.action !== 'hold')
    .sort((a, b) => Math.abs(b.currentWeight - b.targetWeight) - Math.abs(a.currentWeight - a.targetWeight));
}

/**
 * 전체 포트폴리오 분석
 */
export async function analyzePortfolio(
  userId: string,
  portfolioId: string
): Promise<PortfolioAnalysis> {
  try {
    const positions = await getPortfolioPositions(userId, portfolioId);

    const totalValue = positions.reduce((sum, p) => sum + p.totalValue, 0);
    const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0);
    const overallReturnRate = totalInvested > 0 
      ? ((totalValue - totalInvested) / totalInvested) * 100 
      : 0;

    const sectorAllocation = calculateSectorAllocation(positions);
    const regionAllocation = calculateRegionAllocation(positions);
    const assetAllocation = calculateAssetAllocation(positions);
    const riskMetrics = calculateRiskMetrics(positions);
    const topContributors = calculateTopContributors(positions);
    const rebalancingSuggestions = generateRebalancingSuggestions(positions);
    const diversificationScore = calculateDiversificationScore(
      sectorAllocation,
      regionAllocation,
      assetAllocation,
      positions.length
    );

    return {
      portfolioId,
      totalValue,
      totalInvested,
      overallReturnRate,
      sectorAllocation,
      regionAllocation,
      assetAllocation,
      riskMetrics,
      topContributors,
      rebalancingSuggestions,
      diversificationScore,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Portfolio analysis error:', error);
    throw error;
  }
}

