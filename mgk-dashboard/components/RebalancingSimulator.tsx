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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Calculator,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ListFilter,
} from 'lucide-react';
import type { Position, RebalancingPreset } from '@/types';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { assertCurrency, convertWithRate } from '@/lib/currency';
import { buildRebalancingPresets } from '@/lib/utils/rebalancingPresets';
import { formatPercent } from '@/lib/utils/formatters';

interface RebalancingSimulatorProps {
  positions: Position[];
  totalValue: number;
  baseCurrency: 'USD' | 'KRW';
  exchangeRate?: number | null;
}

interface TargetWeight {
  symbol: string;
  currency: 'USD' | 'KRW';
  currentWeight: number;
  targetWeight: number;
  currentValueLocal: number;
  currentValueBase: number;
  targetValueLocal: number;
  targetValueBase: number;
  differenceLocal: number;
  differenceBase: number;
  action: 'buy' | 'sell' | 'hold';
}

interface RebalancingPlanLeg {
  symbol: string;
  action: 'buy' | 'sell';
  currency: 'USD' | 'KRW';
  amountLocal: number;
  amountBase: number;
  feeLocal: number;
  feeBase: number;
  slippageLocal: number;
  slippageBase: number;
  weightChange: number;
  note?: string;
}

interface RebalancingScheduleOption {
  id: 'single' | 'split';
  label: string;
  description: string;
  steps: string[];
}

interface RebalancingExecutionPlan {
  totals: {
    totalBuyBase: number;
    totalSellBase: number;
    grossTradeBase: number;
    estimatedFeesBase: number;
    estimatedSlippageBase: number;
    netFlowBase: number;
    tradeRatio: number;
  };
  buys: RebalancingPlanLeg[];
  sells: RebalancingPlanLeg[];
  schedule: {
    recommended: RebalancingScheduleOption['id'];
    options: RebalancingScheduleOption[];
    notes: string[];
  };
}

const ESTIMATED_FEE_RATE = 0.0012;
const ESTIMATED_SLIPPAGE_RATE = 0.0005;
const MIN_TRADE_THRESHOLD = 1;

export function RebalancingSimulator({ positions, totalValue, baseCurrency, exchangeRate }: RebalancingSimulatorProps) {
  const [targetWeights, setTargetWeights] = useState<Record<string, string>>({});
  const [simulationResult, setSimulationResult] = useState<TargetWeight[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('current');
  const [executionPlan, setExecutionPlan] = useState<RebalancingExecutionPlan | null>(null);
  const { formatAmount } = useCurrency();

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

  const presets = useMemo<RebalancingPreset[]>(() => {
    return buildRebalancingPresets({
      positions,
      baseCurrency,
      exchangeRate,
    });
  }, [positions, baseCurrency, exchangeRate]);

  const positionMap = useMemo(() => {
    const map = new Map<string, Position>();
    positions.forEach((position) => {
      map.set(position.symbol, position);
    });
    return map;
  }, [positions]);

  const formatBaseAmount = useCallback(
    (value: number, options?: { withSign?: boolean }) => {
      const formatted = formatAmount(Math.abs(value), baseCurrency);
      if (options?.withSign) {
        if (Math.abs(value) < 1e-2) {
          return formatted;
        }
        return value >= 0 ? `+${formatted}` : `-${formatted}`;
      }
      return formatted;
    },
    [formatAmount, baseCurrency]
  );

  const buildExecutionPlan = useCallback(
    (weights: TargetWeight[]): RebalancingExecutionPlan | null => {
      if (!weights.length) {
        return null;
      }

      const actionable = weights.filter((item) => Math.abs(item.differenceBase) > MIN_TRADE_THRESHOLD);
      if (!actionable.length) {
        return null;
      }

      const legs: RebalancingPlanLeg[] = actionable.map((item) => {
        const action = item.differenceBase >= 0 ? 'buy' : 'sell';
        const amountBase = Math.abs(item.differenceBase);
        const amountLocal = Math.abs(item.differenceLocal);
        const feeBase = amountBase * ESTIMATED_FEE_RATE;
        const slippageBase = amountBase * ESTIMATED_SLIPPAGE_RATE;
        const feeLocal = amountLocal * ESTIMATED_FEE_RATE;
        const slippageLocal = amountLocal * ESTIMATED_SLIPPAGE_RATE;
        const position = positionMap.get(item.symbol);
        let note: string | undefined;

        if (position) {
          if (action === 'sell') {
            note =
              position.profitLoss >= 0
                ? '이익 일부를 실현하고 비중을 줄입니다.'
                : '손실을 제한하고 절세 효과를 고려합니다.';
          } else {
            note =
              position.returnRate >= 0
                ? '추세가 좋은 종목의 비중을 확대합니다.'
                : '저평가 구간에서 분할 매수를 진행합니다.';
          }
        }

        return {
          symbol: item.symbol,
          action,
          currency: item.currency,
          amountLocal,
          amountBase,
          feeLocal,
          feeBase,
          slippageLocal,
          slippageBase,
          weightChange: item.targetWeight - item.currentWeight,
          note,
        };
      });

      const sells = legs.filter((leg) => leg.action === 'sell');
      const buys = legs.filter((leg) => leg.action === 'buy');

      const totalSellBase = sells.reduce((sum, leg) => sum + leg.amountBase, 0);
      const totalBuyBase = buys.reduce((sum, leg) => sum + leg.amountBase, 0);
      const grossTradeBase = totalSellBase + totalBuyBase;
      const estimatedFeesBase = legs.reduce((sum, leg) => sum + leg.feeBase, 0);
      const estimatedSlippageBase = legs.reduce((sum, leg) => sum + leg.slippageBase, 0);
      const netFlowBase = totalSellBase - totalBuyBase - estimatedFeesBase - estimatedSlippageBase;
      const tradeRatio = totalValue > 0 ? grossTradeBase / totalValue : 0;

      const formatLegList = (entries: RebalancingPlanLeg[]) =>
        entries
          .map(
            (entry) =>
              `${entry.symbol} (${formatBaseAmount(entry.amountBase)} | ${formatPercent(entry.weightChange)})`
          )
          .join(', ');

      const chunkLegs = (entries: RebalancingPlanLeg[], parts: number) => {
        if (!entries.length) {
          return Array.from({ length: parts }, () => [] as RebalancingPlanLeg[]);
        }
        const chunkSize = Math.ceil(entries.length / parts);
        return Array.from({ length: parts }, (_, index) =>
          entries.slice(index * chunkSize, (index + 1) * chunkSize)
        );
      };

      const sellsChunks = chunkLegs(sells, 3);
      const buysChunks = chunkLegs(buys, 3);

      const singleOption: RebalancingScheduleOption = {
        id: 'single',
        label: '한 번에 실행',
        description:
          tradeRatio <= 0.05
            ? '거래 규모가 비교적 작아 한 번에 실행해도 부담이 적습니다.'
            : '시장 유동성이 충분한 시점에 한 번에 실행해 빠르게 리밸런싱하세요.',
        steps: [
          `매도: ${formatLegList(sells) || '없음'}`,
          `매수: ${formatLegList(buys) || '없음'}`,
          '체결 후 목표 비중에 맞게 재확인합니다.',
        ],
      };

      const splitOption: RebalancingScheduleOption = {
        id: 'split',
        label: '3회 분할 실행',
        description: '변동성을 분산하고 슬리피지를 줄이기 위해 1~3주에 걸쳐 단계적으로 실행합니다.',
        steps: [
          `1주차: 매도 ${formatLegList(sellsChunks[0]) || '없음'} / 매수 ${
            formatLegList(buysChunks[0]) || '없음'
          }`,
          `2주차: 매도 ${formatLegList(sellsChunks[1]) || '없음'} / 매수 ${
            formatLegList(buysChunks[1]) || '없음'
          }`,
          `3주차: 매도 ${formatLegList(sellsChunks[2]) || '없음'} / 매수 ${
            formatLegList(buysChunks[2]) || '없음'
          }`,
        ],
      };

      const recommended =
        tradeRatio > 0.08 || grossTradeBase > totalValue * 0.05 ? 'split' : 'single';

      const notes: string[] = [];
      notes.push(`총 거래 규모는 포트폴리오 평가액의 ${formatPercent(tradeRatio * 100)} 수준입니다.`);
      if (Math.abs(netFlowBase) > MIN_TRADE_THRESHOLD) {
        notes.push(
          netFlowBase >= 0
            ? `거래 후 현금이 ${formatBaseAmount(netFlowBase, { withSign: true })} 만큼 증가합니다.`
            : `거래 후 현금이 ${formatBaseAmount(netFlowBase, { withSign: true })} 만큼 감소합니다.`
        );
      } else {
        notes.push('매도 대금과 매수 금액이 유사하여 현금 변동은 크지 않습니다.');
      }

      if (estimatedFeesBase > MIN_TRADE_THRESHOLD) {
        notes.push(
          `예상 수수료와 슬리피지는 총 ${formatBaseAmount(
            estimatedFeesBase + estimatedSlippageBase
          )} 정도입니다.`
        );
      }

      return {
        totals: {
          totalBuyBase,
          totalSellBase,
          grossTradeBase,
          estimatedFeesBase,
          estimatedSlippageBase,
          netFlowBase,
          tradeRatio,
        },
        buys,
        sells,
        schedule: {
          recommended,
          options: [singleOption, splitOption],
          notes,
        },
      };
    },
    [formatBaseAmount, positionMap, totalValue]
  );

  useEffect(() => {
    if (!presets.length) {
      setTargetWeights({});
      return;
    }

    if (selectedPreset === 'custom') {
      return;
    }

    const preset =
      presets.find((item) => item.id === selectedPreset) ??
      presets.find((item) => item.id === 'current') ??
      presets[0];

    if (!preset) {
      return;
    }

    setTargetWeights(convertWeightsToState(preset.weights, positions.map((p) => p.symbol)));
    if (preset.id !== selectedPreset) {
      setSelectedPreset(preset.id);
    }
  }, [presets, selectedPreset, positions]);

  const applyPreset = useCallback(
    (presetId: string) => {
      setSelectedPreset(presetId);
      setShowResult(false);
      setSimulationResult([]);
      setExecutionPlan(null);
    },
    []
  );

  // 초기 가중치 설정
  // 균등 분배 설정
  const handleEqualDistribution = useCallback(() => {
    applyPreset('equal');
  }, [applyPreset]);

  // 현재 비중 유지
  const handleKeepCurrent = useCallback(() => {
    applyPreset('current');
  }, [applyPreset]);

  // 가중치 변경
  const handleWeightChange = (symbol: string, value: string) => {
    setTargetWeights({
      ...targetWeights,
      [symbol]: value,
    });
    setSelectedPreset('custom');
    setShowResult(false);
    setSimulationResult([]);
    setExecutionPlan(null);
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
        currentValueBase: baseValue,
        targetValueLocal: fromBase(targetValueBase, currency),
        targetValueBase,
        differenceLocal: fromBase(differenceBase, currency),
        differenceBase,
        action,
      });
    });

    // 목표 비중 합계 검증
    if (Math.abs(totalTarget - 100) > 0.1) {
      alert(`목표 비중의 합이 100%가 아닙니다. (현재: ${totalTarget.toFixed(1)}%)`);
      return;
    }

    setSimulationResult(results);
    setExecutionPlan(buildExecutionPlan(results));
    setShowResult(true);
  };

  // 리셋
  const handleReset = () => {
    setShowResult(false);
    setSimulationResult([]);
    if (selectedPreset === 'custom') {
      applyPreset('current');
    } else {
      applyPreset(selectedPreset);
    }
  };

  const totalTargetWeight = Object.values(targetWeights).reduce(
    (sum, w) => sum + parseFloat(w || '0'),
    0
  );

  const isValidTotal = Math.abs(totalTargetWeight - 100) < 0.1;

  const activePreset =
    selectedPreset === 'custom'
      ? null
      : presets.find((preset) => preset.id === selectedPreset) ?? null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <CardTitle>리밸런싱 시뮬레이터</CardTitle>
          </div>
          <div className="flex gap-2">
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
            {presets.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListFilter className="mr-2 h-4 w-4" />
                    프리셋
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>프리셋 불러오기</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {presets.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onSelect={(event) => {
                        event.preventDefault();
                        applyPreset(preset.id);
                      }}
                      className={preset.id === selectedPreset ? 'bg-muted' : ''}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">{preset.name}</span>
                        <span className="text-xs text-muted-foreground">{preset.description}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <CardDescription>
          목표 비중을 입력하면 필요한 매수·매도 금액과 실행 순서를 자동으로 제안합니다. 변동성이 큰 시기에는
          분할 실행 옵션을 활용해 리스크를 나눠보세요.
        </CardDescription>
        <ul className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
          <li className="rounded-md bg-muted/40 p-3">
            <p className="font-semibold text-foreground">1. 비중 확인</p>
            <p>현재 비중과 목표 비중의 차이를 확인합니다.</p>
          </li>
          <li className="rounded-md bg-muted/40 p-3">
            <p className="font-semibold text-foreground">2. 실행 금액 계산</p>
            <p>각 종목별 필요한 매수·매도 금액을 시뮬레이션합니다.</p>
          </li>
          <li className="rounded-md bg-muted/40 p-3">
            <p className="font-semibold text-foreground">3. 체크리스트 확인</p>
            <p>한 번에 실행할지, 분할할지 결정하고 수수료/현금 흐름을 점검합니다.</p>
          </li>
        </ul>
        {activePreset && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{activePreset.name}</Badge>
            <span>{activePreset.description}</span>
          </div>
        )}
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
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">요약</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>매수 필요</span>
                  <span className="font-medium text-green-600">
                    {simulationResult.filter(r => r.action === 'buy').length}개 종목
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>매도 필요</span>
                  <span className="font-medium text-red-600">
                    {simulationResult.filter(r => r.action === 'sell').length}개 종목
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>유지</span>
                  <span className="font-medium text-muted-foreground">
                    {simulationResult.filter(r => r.action === 'hold').length}개 종목
                  </span>
                </div>
              </div>
            </div>

            {executionPlan ? (
              <div className="space-y-4 rounded-lg border border-primary/10 bg-background/70 p-4">
                <div className="space-y-2">
                  <h4 className="text-base font-semibold text-primary">리밸런싱 실행 계획</h4>
                  <p className="text-xs text-muted-foreground">
                    자동 계산된 예상 비용과 단계별 실행 전략을 확인하고 필요 시 수동 조정하세요.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-muted-foreground">총 매도</p>
                    <p className="text-sm font-semibold text-destructive">
                      {formatBaseAmount(executionPlan.totals.totalSellBase)}
                    </p>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                    <p className="text-xs text-muted-foreground">총 매수</p>
                    <p className="text-sm font-semibold text-emerald-600">
                      {formatBaseAmount(executionPlan.totals.totalBuyBase)}
                    </p>
                  </div>
                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs text-muted-foreground">예상 수수료·슬리피지</p>
                    <p className="text-sm font-semibold text-primary">
                      {formatBaseAmount(
                        executionPlan.totals.estimatedFeesBase + executionPlan.totals.estimatedSlippageBase
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-muted p-3">
                    <p className="text-xs text-muted-foreground">순현금 변동</p>
                    <p
                      className={`text-sm font-semibold ${
                        executionPlan.totals.netFlowBase >= 0 ? 'text-emerald-600' : 'text-destructive'
                      }`}
                    >
                      {formatBaseAmount(executionPlan.totals.netFlowBase, { withSign: true })}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
                    <h5 className="text-sm font-semibold text-destructive">매도 계획</h5>
                    {executionPlan.sells.length ? (
                      executionPlan.sells.map((leg) => (
                        <div
                          key={`sell-${leg.symbol}`}
                          className="space-y-2 rounded-md border border-destructive/30 bg-background/80 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{leg.symbol}</span>
                            <Badge variant="destructive">매도</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>거래 금액</span>
                            <span className="text-right font-medium text-foreground">
                              {formatAmount(leg.amountLocal, leg.currency)}
                            </span>
                            <span>예상 비용</span>
                            <span className="text-right">
                              {formatAmount(leg.feeLocal + leg.slippageLocal, leg.currency)}
                            </span>
                            <span>비중 변화</span>
                            <span className="text-right font-medium text-foreground">
                              {formatPercent(leg.weightChange)}
                            </span>
                          </div>
                          {leg.note ? (
                            <p className="text-xs text-muted-foreground">💡 {leg.note}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">매도 대상 종목이 없습니다.</p>
                    )}
                  </div>

                  <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-4">
                    <h5 className="text-sm font-semibold text-emerald-700">매수 계획</h5>
                    {executionPlan.buys.length ? (
                      executionPlan.buys.map((leg) => (
                        <div
                          key={`buy-${leg.symbol}`}
                          className="space-y-2 rounded-md border border-emerald-200 bg-background/80 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{leg.symbol}</span>
                            <Badge className="bg-emerald-600 hover:bg-emerald-600">매수</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>거래 금액</span>
                            <span className="text-right font-medium text-foreground">
                              {formatAmount(leg.amountLocal, leg.currency)}
                            </span>
                            <span>예상 비용</span>
                            <span className="text-right">
                              {formatAmount(leg.feeLocal + leg.slippageLocal, leg.currency)}
                            </span>
                            <span>비중 변화</span>
                            <span className="text-right font-medium text-foreground">
                              {formatPercent(leg.weightChange)}
                            </span>
                          </div>
                          {leg.note ? (
                            <p className="text-xs text-muted-foreground">💡 {leg.note}</p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">매수 대상 종목이 없습니다.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-md border border-primary/15 bg-primary/5 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-semibold text-primary">실행 스케줄 제안</h5>
                    <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                      추천: {executionPlan.schedule.recommended === 'split' ? '3회 분할' : '한 번에 실행'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {executionPlan.schedule.options.map((option) => (
                      <div
                        key={option.id}
                        className={`space-y-2 rounded-md border p-3 ${
                          option.id === executionPlan.schedule.recommended
                            ? 'border-primary bg-background'
                            : 'border-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{option.label}</span>
                          {option.id === executionPlan.schedule.recommended ? (
                            <Badge className="bg-primary text-primary-foreground text-xs">추천</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
                        <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                          {option.steps.map((step, index) => (
                            <li key={`${option.id}-step-${index}`}>• {step}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  {executionPlan.schedule.notes.length ? (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {executionPlan.schedule.notes.map((note, index) => (
                        <li key={`plan-note-${index}`}>- {note}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function convertWeightsToState(
  weights: Record<string, number>,
  orderedSymbols: string[]
): Record<string, string> {
  if (!orderedSymbols.length) {
    return {};
  }

  const result: Record<string, string> = {};
  let running = 0;

  orderedSymbols.forEach((symbol, index) => {
    const raw = weights[symbol] ?? 0;
    let rounded = parseFloat(raw.toFixed(1));

    if (index === orderedSymbols.length - 1) {
      rounded = parseFloat((100 - running).toFixed(1));
    }

    rounded = Math.max(0, parseFloat(rounded.toFixed(1)));
    running = parseFloat((running + rounded).toFixed(1));
    result[symbol] = rounded.toFixed(1);
  });

  return result;
}

