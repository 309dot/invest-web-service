/**
 * 리밸런싱 시뮬레이터 컴포넌트
 * 
 * 목표 비중 설정 및 매수/매도 시뮬레이션
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Calculator,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Position } from '@/types';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { assertCurrency, convertWithRate } from '@/lib/currency';

interface RebalancingSimulatorProps {
  positions: Position[];
  totalValue: number;
  baseCurrency: 'USD' | 'KRW';
  exchangeRate?: number | null;
  suggestions?: PortfolioAnalysis['rebalancingSuggestions'];
}

interface TargetWeight {
  symbol: string;
  currency: 'USD' | 'KRW';
  currentWeight: number;
  targetWeight: number;
  currentValueLocal: number;
  targetValueLocal: number;
  differenceLocal: number;
  action: 'buy' | 'sell' | 'hold';
  currentValueBase: number;
  targetValueBase: number;
  differenceBase: number;
}

export function RebalancingSimulator({
  positions,
  totalValue,
  baseCurrency,
  exchangeRate,
  suggestions,
}: RebalancingSimulatorProps) {
  const [targetWeights, setTargetWeights] = useState<Record<string, string>>({});
  const [simulationResult, setSimulationResult] = useState<TargetWeight[]>([]);
  const [showResult, setShowResult] = useState(false);
  const { formatAmount } = useCurrency();
  const formatBaseAmount = useCallback(
    (value: number) => formatAmount(value, baseCurrency),
    [formatAmount, baseCurrency]
  );

  const positionMap = useMemo(() => {
    const map = new Map<string, Position>();
    positions.forEach((position) => map.set(position.symbol, position));
    return map;
  }, [positions]);

  const executionPlan = useMemo(() => {
    return simulationResult
      .filter((item) => item.action !== 'hold')
      .map((item) => ({
        ...item,
        absDifference: Math.abs(item.differenceBase),
      }))
      .sort((a, b) => b.absDifference - a.absDifference);
  }, [simulationResult]);

  const totalBuyBase = useMemo(
    () =>
      executionPlan
        .filter((item) => item.action === 'buy')
        .reduce((sum, item) => sum + item.differenceBase, 0),
    [executionPlan]
  );

  const totalSellBase = useMemo(
    () =>
      executionPlan
        .filter((item) => item.action === 'sell')
        .reduce((sum, item) => sum + Math.abs(item.differenceBase), 0),
    [executionPlan]
  );

  const taxLossCandidates = useMemo(
    () =>
      executionPlan.filter((item) => {
        if (item.action !== 'sell') return false;
        const position = positionMap.get(item.symbol);
        return (position?.profitLoss ?? 0) < 0;
      }),
    [executionPlan, positionMap]
  );

  const taxGainCandidates = useMemo(
    () =>
      executionPlan.filter((item) => {
        if (item.action !== 'sell') return false;
        const position = positionMap.get(item.symbol);
        return (position?.profitLoss ?? 0) > 0;
      }),
    [executionPlan, positionMap]
  );

  const applyNormalizedWeights = useCallback(
    (rawWeights: Record<string, number>) => {
      const sanitized: Record<string, number> = {};
      positions.forEach((position) => {
        const value = Math.max(rawWeights[position.symbol] ?? 0, 0);
        sanitized[position.symbol] = Number.isFinite(value) ? value : 0;
      });

      const sum = Object.values(sanitized).reduce((acc, value) => acc + value, 0);
      const normalized: Record<string, string> = {};

      positions.forEach((position) => {
        const raw = sanitized[position.symbol] ?? 0;
        const percentage = sum > 0 ? (raw / sum) * 100 : 0;
        normalized[position.symbol] = percentage.toFixed(1);
      });

      setTargetWeights(normalized);
    },
    [positions]
  );

  const toBase = useCallback(
    (value: number, currency: 'USD' | 'KRW') => {
      if (baseCurrency === 'KRW') {
        if (currency === 'KRW') return value;
        if (!exchangeRate) return value;
        return convertWithRate(value, 'USD', 'KRW', exchangeRate);
      }

      if (currency === 'USD') return value;
      if (!exchangeRate) return value;
      return convertWithRate(value, 'KRW', 'USD', exchangeRate);
    },
    [baseCurrency, exchangeRate]
  );

  const fromBase = useCallback(
    (value: number, currency: 'USD' | 'KRW') => {
      if (baseCurrency === 'KRW') {
        if (currency === 'KRW') return value;
        if (!exchangeRate) return value;
        return convertWithRate(value, 'KRW', 'USD', exchangeRate);
      }

      if (currency === 'USD') return value;
      if (!exchangeRate) return value;
      return convertWithRate(value, 'USD', 'KRW', exchangeRate);
    },
    [baseCurrency, exchangeRate]
  );

  // 초기 가중치 설정
  useEffect(() => {
    const currentWeights: Record<string, number> = {};
    positions.forEach((position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      const baseValue = toBase(position.totalValue, currency);
      currentWeights[position.symbol] = baseValue;
    });
    applyNormalizedWeights(currentWeights);
  }, [positions, totalValue, toBase, applyNormalizedWeights]);

  // 균등 분배 설정
  const handleEqualDistribution = () => {
    const weights: Record<string, number> = {};
    positions.forEach((position) => {
      weights[position.symbol] = 1;
    });
    applyNormalizedWeights(weights);
  };

  // 현재 비중 유지
  const handleKeepCurrent = () => {
    const weights: Record<string, number> = {};
    positions.forEach((position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      const baseValue = toBase(position.totalValue, currency);
      weights[position.symbol] = baseValue;
    });
    applyNormalizedWeights(weights);
  };

  const handleDefensivePreset = () => {
    const weights: Record<string, number> = {};
    positions.forEach((position) => {
      const riskScore = Math.abs(position.returnRate ?? 0) + 5;
      weights[position.symbol] = 1 / riskScore;
    });
    applyNormalizedWeights(weights);
  };

  const handleAggressivePreset = () => {
    const weights: Record<string, number> = {};
    let hasPositive = false;

    positions.forEach((position) => {
      const momentum = position.returnRate ?? 0;
      if (momentum > 0) {
        hasPositive = true;
      }
      weights[position.symbol] = Math.max(momentum, 0) + 1;
    });

    if (!hasPositive) {
      handleEqualDistribution();
      return;
    }

    applyNormalizedWeights(weights);
  };

  const handleAISuggestionPreset = () => {
    if (!suggestions || suggestions.length === 0) {
      alert('AI 리밸런싱 제안이 없습니다.');
      return;
    }

    const suggestionMap = new Map<string, number>();
    suggestions.forEach((suggestion) => {
      if (suggestion.symbol && Number.isFinite(suggestion.targetWeight)) {
        suggestionMap.set(suggestion.symbol, Math.max(suggestion.targetWeight, 0));
      }
    });

    const weights: Record<string, number> = {};
    positions.forEach((position) => {
      if (suggestionMap.has(position.symbol)) {
        weights[position.symbol] = suggestionMap.get(position.symbol)!;
      } else {
        const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
        const baseValue = toBase(position.totalValue, currency);
        weights[position.symbol] = baseValue;
      }
    });

    applyNormalizedWeights(weights);
  };

  // 가중치 변경
  const handleWeightChange = (symbol: string, value: string) => {
    setTargetWeights({
      ...targetWeights,
      [symbol]: value,
    });
  };

  // 시뮬레이션 실행
  const handleSimulate = () => {
    const results: TargetWeight[] = [];
    let totalTarget = 0;

    positions.forEach((position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      const baseValue = toBase(position.totalValue, currency);
      const currentWeight = totalValue > 0 ? (baseValue / totalValue) * 100 : 0;
      const targetWeight = parseFloat(targetWeights[position.symbol] || '0');
      const targetValueBase = (totalValue * targetWeight) / 100;
      const differenceBase = targetValueBase - baseValue;

      totalTarget += targetWeight;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      if (Math.abs(differenceBase) >= totalValue * 0.01) {
        action = differenceBase > 0 ? 'buy' : 'sell';
      }

      results.push({
        symbol: position.symbol,
        currency,
        currentWeight,
        targetWeight,
        currentValueLocal: position.totalValue,
        targetValueLocal: fromBase(targetValueBase, currency),
        differenceLocal: fromBase(differenceBase, currency),
        action,
        currentValueBase: baseValue,
        targetValueBase,
        differenceBase,
      });
    });

    // 목표 비중 합계 검증
    if (Math.abs(totalTarget - 100) > 0.1) {
      alert(`목표 비중의 합이 100%가 아닙니다. (현재: ${totalTarget.toFixed(1)}%)`);
      return;
    }

    setSimulationResult(results);
    setShowResult(true);
  };

  // 리셋
  const handleReset = () => {
    setShowResult(false);
    setSimulationResult([]);
    handleKeepCurrent();
  };

  const totalTargetWeight = Object.values(targetWeights).reduce(
    (sum, w) => sum + parseFloat(w || '0'),
    0
  );

  const isValidTotal = Math.abs(totalTargetWeight - 100) < 0.1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <CardTitle>리밸런싱 시뮬레이터</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEqualDistribution}
            >
              균등 분배
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleKeepCurrent}
            >
              현재 유지
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDefensivePreset}
            >
              안정형
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAggressivePreset}
            >
              공격형
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAISuggestionPreset}
              disabled={!suggestions || suggestions.length === 0}
            >
              AI 추천
            </Button>
          </div>
        </div>
        <CardDescription>
          목표 비중을 설정하고 리밸런싱을 시뮬레이션합니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 목표 비중 입력 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">목표 비중 설정</Label>
            <Badge variant={isValidTotal ? 'default' : 'destructive'}>
              합계: {totalTargetWeight.toFixed(1)}%
            </Badge>
          </div>

          {!isValidTotal && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                목표 비중의 합이 100%가 되어야 합니다.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3">
            {positions.map((position) => {
              const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
              const baseValue = toBase(position.totalValue, currency);
              const currentWeight = totalValue > 0 ? (baseValue / totalValue) * 100 : 0;
              return (
                <div key={position.symbol} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{position.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      현재: {currentWeight.toFixed(1)}% ({formatAmount(position.totalValue, currency)})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={targetWeights[position.symbol] || ''}
                      onChange={(e) => handleWeightChange(position.symbol, e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 시뮬레이션 버튼 */}
        <div className="flex gap-2">
          <Button
            onClick={handleSimulate}
            disabled={!isValidTotal}
            className="flex-1"
          >
            <Calculator className="mr-2 h-4 w-4" />
            시뮬레이션 실행
          </Button>
          {showResult && (
            <Button
              variant="outline"
              onClick={handleReset}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              초기화
            </Button>
          )}
        </div>

        {/* 시뮬레이션 결과 */}
        {showResult && simulationResult.length > 0 && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold text-lg">시뮬레이션 결과</h3>
            </div>

            {/* 데스크톱: 테이블 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium">종목</th>
                    <th className="text-right py-2 px-2 font-medium">현재 비중</th>
                    <th className="text-right py-2 px-2 font-medium">목표 비중</th>
                    <th className="text-right py-2 px-2 font-medium">현재 금액</th>
                    <th className="text-right py-2 px-2 font-medium">목표 금액</th>
                    <th className="text-center py-2 px-2 font-medium">액션</th>
                    <th className="text-right py-2 px-2 font-medium">차이</th>
                  </tr>
                </thead>
                <tbody>
                  {simulationResult.map((result) => (
                    <tr key={result.symbol} className="border-b">
                      <td className="py-2 px-2 font-semibold">{result.symbol}</td>
                      <td className="py-2 px-2 text-right">{result.currentWeight.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right font-medium">{result.targetWeight.toFixed(1)}%</td>
                      <td className="py-2 px-2 text-right">{formatAmount(result.currentValueLocal, result.currency)}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatAmount(result.targetValueLocal, result.currency)}</td>
                      <td className="py-2 px-2 text-center">
                        <Badge
                          variant={
                            result.action === 'buy' ? 'default' :
                            result.action === 'sell' ? 'destructive' :
                            'outline'
                          }
                          className="flex items-center gap-1 w-fit mx-auto"
                        >
                          {result.action === 'buy' && <TrendingUp className="h-3 w-3" />}
                          {result.action === 'sell' && <TrendingDown className="h-3 w-3" />}
                          {result.action === 'buy' ? '매수' : result.action === 'sell' ? '매도' : '유지'}
                        </Badge>
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${
                        result.differenceLocal > 0 ? 'text-green-600' : 
                        result.differenceLocal < 0 ? 'text-red-600' : 
                        'text-muted-foreground'
                      }`}>
                        {result.differenceLocal >= 0 ? '+' : ''}{formatAmount(result.differenceLocal, result.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 모바일: 카드 */}
            <div className="md:hidden space-y-3">
              {simulationResult.map((result) => (
                <Card key={result.symbol}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-lg">{result.symbol}</h4>
                        <p className="text-sm text-muted-foreground">
                          {result.currentWeight.toFixed(1)}% → {result.targetWeight.toFixed(1)}%
                        </p>
                      </div>
                      <Badge
                        variant={
                          result.action === 'buy' ? 'default' :
                          result.action === 'sell' ? 'destructive' :
                          'outline'
                        }
                        className="flex items-center gap-1"
                      >
                        {result.action === 'buy' && <TrendingUp className="h-3 w-3" />}
                        {result.action === 'sell' && <TrendingDown className="h-3 w-3" />}
                        {result.action === 'buy' ? '매수' : result.action === 'sell' ? '매도' : '유지'}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">현재 금액</span>
                        <span className="font-medium">{formatAmount(result.currentValueLocal, result.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">목표 금액</span>
                        <span className="font-medium">{formatAmount(result.targetValueLocal, result.currency)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">차이</span>
                        <span className={`font-semibold ${
                          result.differenceLocal > 0 ? 'text-green-600' : 
                          result.differenceLocal < 0 ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          {result.differenceLocal >= 0 ? '+' : ''}{formatAmount(result.differenceLocal, result.currency)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 요약 */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <div>
                <h4 className="font-semibold mb-2">요약</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>매수 필요</span>
                    <span className="font-medium text-green-600">
                      {simulationResult.filter(r => r.action === 'buy').length}개 종목 · {formatBaseAmount(Math.max(totalBuyBase, 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>매도 필요</span>
                    <span className="font-medium text-red-600">
                      {simulationResult.filter(r => r.action === 'sell').length}개 종목 · {formatBaseAmount(totalSellBase)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>유지</span>
                    <span className="font-medium text-muted-foreground">
                      {simulationResult.filter(r => r.action === 'hold').length}개 종목
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span>순매수/순매도</span>
                    <span
                      className={`font-semibold ${
                        totalBuyBase - totalSellBase >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatBaseAmount(totalBuyBase - totalSellBase)}
                    </span>
                  </div>
                </div>
              </div>

              {executionPlan.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold">권장 실행 순서</h5>
                  <ol className="space-y-2 text-sm list-decimal list-inside">
                    {executionPlan.map((item, index) => {
                      const position = positionMap.get(item.symbol);
                      const localDifference = Math.abs(item.differenceLocal);
                      const baseDifference = Math.abs(item.differenceBase);
                      return (
                        <li key={`plan-${item.symbol}-${index}`} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">
                              {item.action === 'buy' ? '매수' : '매도'} {item.symbol}
                            </span>
                            <span
                              className={
                                item.action === 'buy'
                                  ? 'text-green-600 font-semibold'
                                  : 'text-red-600 font-semibold'
                              }
                            >
                              {item.action === 'buy' ? '+' : '-'}
                              {formatBaseAmount(baseDifference)} ({formatAmount(localDifference, item.currency)})
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                            <span>
                              현재 {item.currentWeight.toFixed(1)}% → 목표 {item.targetWeight.toFixed(1)}%
                            </span>
                            {position && (
                              <span>
                                평가손익 {formatAmount(position.profitLoss, position.currency)}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>

            {taxLossCandidates.length > 0 && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {taxLossCandidates.map((item) => item.symbol).join(', ')} 종목은 손실 구간입니다. 세금
                  최적화를 위해 손실 상쇄 전략을 고려하세요.
                </AlertDescription>
              </Alert>
            )}

            {taxGainCandidates.length > 0 && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  {taxGainCandidates.map((item) => item.symbol).join(', ')} 종목은 이익 실현 대상입니다.
                  세금 부담을 고려해 분할 매도 또는 보유 기간을 검토하세요.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

