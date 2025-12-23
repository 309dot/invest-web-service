/**
 * 리밸런싱 시뮬레이터 컴포넌트
 * 
 * 목표 비중 설정 및 매수/매도 시뮬레이션
 */

"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import {
  Calculator,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import type { Position } from '@/types';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { assertCurrency, convertWithRate } from '@/lib/currency';
import { getProfitTextClass, PROFIT_TEXT_NEGATIVE, PROFIT_TEXT_POSITIVE } from '@/lib/utils/formatters';

interface RebalancingSimulatorProps {
  positions: Position[];
  totalValue: number;
  baseCurrency: 'USD' | 'KRW';
  exchangeRate?: number | null;
}

type PresetId = 'equal' | 'current' | 'conservative' | 'aggressive' | 'ai';

interface RebalancePreset {
  id: PresetId;
  label: string;
  description: string;
  badge?: string;
}

const PRESETS: RebalancePreset[] = [
  { id: 'equal', label: '균등 분산', description: '모든 종목을 동일한 비중으로 유지합니다.' },
  { id: 'current', label: '현재 유지', description: '현재 비중을 그대로 유지합니다.' },
  { id: 'conservative', label: '안정형', description: '대형주와 ETF 비중을 높여 변동성을 낮춥니다.' },
  { id: 'aggressive', label: '공격형', description: '성장주 비중을 높여 수익률을 추구합니다.' },
  { id: 'ai', label: 'AI 추천', description: '포지션 데이터를 기반으로 AI가 제안합니다.', badge: 'Beta' },
];

interface TargetWeight {
  symbol: string;
  currency: 'USD' | 'KRW';
  currentWeight: number;
  targetWeight: number;
  currentValueLocal: number;
  targetValueLocal: number;
  differenceLocal: number;
  action: 'buy' | 'sell' | 'hold';
  estimatedFeeLocal: number;
  estimatedTaxLocal: number;
  netImpactLocal: number;
  suggestedTranches: number;
}

export function RebalancingSimulator({ positions, totalValue, baseCurrency, exchangeRate }: RebalancingSimulatorProps) {
  const [targetWeights, setTargetWeights] = useState<Record<string, string>>({});
  const [simulationResult, setSimulationResult] = useState<TargetWeight[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const [presetNote, setPresetNote] = useState<string | null>(null);

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

  // 초기 가중치 설정
  useEffect(() => {
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      const baseValue = toBase(position.totalValue, currency);
      const currentWeight = totalValue > 0 ? (baseValue / totalValue) * 100 : 0;
      weights[position.symbol] = currentWeight.toFixed(1);
    });
    setTargetWeights(weights);
  }, [positions, totalValue, toBase]);

  // 균등 분배 설정
  const handleEqualDistribution = () => {
    const equalWeight = positions.length > 0 ? (100 / positions.length).toFixed(1) : '0';
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      weights[position.symbol] = equalWeight;
    });
    setTargetWeights(weights);
    setActivePreset('equal');
    setPresetNote('모든 종목을 동일한 비중으로 유지하도록 설정되었습니다.');
  };

  // 현재 비중 유지
  const handleKeepCurrent = () => {
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      const baseValue = toBase(position.totalValue, currency);
      const currentWeight = totalValue > 0 ? (baseValue / totalValue) * 100 : 0;
      weights[position.symbol] = currentWeight.toFixed(1);
    });
    setTargetWeights(weights);
    setActivePreset('current');
    setPresetNote('현재 보유 비중을 기준으로 리밸런싱을 실행합니다.');
  };

  const handlePresetApply = (preset: PresetId) => {
    if (preset === 'equal') {
      handleEqualDistribution();
      return;
    }
    if (preset === 'current') {
      handleKeepCurrent();
      return;
    }

    const weights: Record<string, string> = {};
    const sortedByWeight = [...positions].sort((a, b) => {
      const currencyA = assertCurrency(a.currency, a.market === 'KR' ? 'KRW' : 'USD');
      const currencyB = assertCurrency(b.currency, b.market === 'KR' ? 'KRW' : 'USD');
      const valueA = toBase(a.totalValue, currencyA);
      const valueB = toBase(b.totalValue, currencyB);
      return valueB - valueA;
    });

    if (preset === 'conservative') {
      sortedByWeight.forEach((position) => {
        const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
        const currentWeight = totalValue > 0 ? (toBase(position.totalValue, currency) / totalValue) * 100 : 0;
        const isETF = position.assetType === 'etf';
        const isLargeCap = currentWeight >= 10;
        let target = currentWeight;

        if (isETF) {
          target = Math.min(currentWeight + 5, currentWeight * 1.3);
        } else if (isLargeCap) {
          target = currentWeight + 3;
        } else {
          target = currentWeight * 0.7;
        }
        weights[position.symbol] = target.toFixed(1);
      });
      setPresetNote('안정형 포트폴리오: 대형주와 ETF 비중을 높이고 성장주의 비중을 낮춰 변동성을 줄입니다.');
    } else if (preset === 'aggressive') {
      sortedByWeight.forEach((position, index) => {
        const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
        const currentWeight = totalValue > 0 ? (toBase(position.totalValue, currency) / totalValue) * 100 : 0;
        const isGrowthStock = position.returnRate > 0 || index < Math.ceil(sortedByWeight.length / 2);
        let target = currentWeight;
        if (isGrowthStock) {
          target = currentWeight * 1.25 + 1;
        } else {
          target = currentWeight * 0.6;
        }
        weights[position.symbol] = target.toFixed(1);
      });
      setPresetNote('공격형 포트폴리오: 성장주와 성과가 좋은 종목 비중을 높여 수익률을 추구합니다.');
    } else if (preset === 'ai') {
      sortedByWeight.forEach((position, index) => {
        const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
        const currentWeight = totalValue > 0 ? (toBase(position.totalValue, currency) / totalValue) * 100 : 0;
        const growthScore = normalizeGrowthScore(position.returnRate);
        const stabilityScore = normalizeStabilityScore(position.returnRate, position.profitLoss);
        const weightHint = (growthScore * 0.6 + stabilityScore * 0.4) * 100;
        const rankingBonus = Math.max(sortedByWeight.length - index, 1);

        const target = (currentWeight * 0.4) + (weightHint * 0.35) + rankingBonus;
        weights[position.symbol] = Math.max(target, 0).toFixed(1);
      });
      setPresetNote('AI 추천 포트폴리오: 수익률과 안정성을 고려해 자동으로 목표 비중을 설정했습니다.');
    }

    normalizeWeights(weights);
    setTargetWeights(weights);
    setActivePreset(preset);
  };

  function normalizeWeights(weights: Record<string, string>) {
    const total = Object.values(weights).reduce((sum, value) => sum + parseFloat(value || '0'), 0);
    if (total <= 0) {
      return;
    }
    const scale = 100 / total;
    Object.entries(weights).forEach(([symbol, value]) => {
      weights[symbol] = (parseFloat(value || '0') * scale).toFixed(1);
    });
  }

  const presetLabel = useMemo(() => {
    if (!activePreset) {
      return '프리셋 선택';
    }
    const preset = PRESETS.find((item) => item.id === activePreset);
    return preset ? preset.label : '프리셋 선택';
  }, [activePreset]);

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

      const differenceLocal = fromBase(differenceBase, currency);
      const feeRate = action === 'buy' ? 0.0015 : 0.002;
      const taxRate = action === 'sell' ? 0.003 : 0;
      const estimatedFeeLocal = Math.abs(differenceLocal) * feeRate;
      const estimatedTaxLocal = Math.max(0, differenceLocal < 0 ? Math.abs(differenceLocal) * taxRate : 0);
      const netImpactLocal = differenceLocal - estimatedFeeLocal - estimatedTaxLocal;
      const suggestedTranches = Math.abs(differenceLocal) > 1000 ? 3 : 1;

      results.push({
        symbol: position.symbol,
        currency,
        currentWeight,
        targetWeight,
        currentValueLocal: position.totalValue,
        targetValueLocal: fromBase(targetValueBase, currency),
        differenceLocal,
        action,
        estimatedFeeLocal,
        estimatedTaxLocal,
        netImpactLocal,
        suggestedTranches,
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
    setPresetNote(null);
    setActivePreset('current');
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
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {presetLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>목표 비중 프리셋</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRESETS.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    className="flex flex-col items-start gap-1"
                    onClick={() => handlePresetApply(preset.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{preset.label}</span>
                      {preset.badge ? (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {preset.badge}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              onClick={handleKeepCurrent}
            >
              현재 유지
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

          {presetNote ? (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>{presetNote}</AlertDescription>
            </Alert>
          ) : null}

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
              <CheckCircle2 className={`h-5 w-5 ${PROFIT_TEXT_POSITIVE}`} />
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
                      <td className={`py-2 px-2 text-right font-semibold ${getProfitTextClass(result.differenceLocal, { zeroAsNeutral: true })}`}>
                        {result.differenceLocal >= 0 ? '+' : ''}{formatAmount(result.differenceLocal, result.currency)}
                      </td>
                      <td className="py-2 px-2 text-right text-xs text-muted-foreground">
                        수수료 {formatAmount(result.estimatedFeeLocal, result.currency)}<br />
                        {result.estimatedTaxLocal > 0 ? `세금 ${formatAmount(result.estimatedTaxLocal, result.currency)}` : '세금 없음'}
                      </td>
                      <td className={`py-2 px-2 text-right font-semibold ${getProfitTextClass(result.netImpactLocal, { zeroAsNeutral: true })}`}>
                        {result.netImpactLocal >= 0 ? '+' : ''}{formatAmount(result.netImpactLocal, result.currency)}
                      </td>
                      <td className="py-2 px-2 text-center text-sm text-muted-foreground">
                        {result.suggestedTranches === 1 ? '1회 실행' : `${result.suggestedTranches}회 분할`}
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
                        <span className={`font-semibold ${getProfitTextClass(result.differenceLocal, { zeroAsNeutral: true })}`}>
                          {result.differenceLocal >= 0 ? '+' : ''}{formatAmount(result.differenceLocal, result.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>예상 수수료</span>
                        <span>{formatAmount(result.estimatedFeeLocal, result.currency)}</span>
                      </div>
                      {result.estimatedTaxLocal > 0 ? (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>예상 세금</span>
                          <span>{formatAmount(result.estimatedTaxLocal, result.currency)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>실제 적용 금액</span>
                        <span className={`font-semibold ${getProfitTextClass(result.netImpactLocal, { zeroAsNeutral: true })}`}>
                          {result.netImpactLocal >= 0 ? '+' : ''}{formatAmount(result.netImpactLocal, result.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>실행 추천</span>
                        <span>{result.suggestedTranches === 1 ? '단일 실행' : `${result.suggestedTranches}회 분할`}</span>
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
                  <span className={`font-medium ${PROFIT_TEXT_POSITIVE}`}>
                    {simulationResult.filter(r => r.action === 'buy').length}개 종목
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>매도 필요</span>
                  <span className={`font-medium ${PROFIT_TEXT_NEGATIVE}`}>
                    {simulationResult.filter(r => r.action === 'sell').length}개 종목
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>유지</span>
                  <span className="font-medium text-muted-foreground">
                    {simulationResult.filter(r => r.action === 'hold').length}개 종목
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span>예상 총 수수료</span>
                  <span className="font-medium text-muted-foreground">
                    {formatAmount(
                      simulationResult.reduce((sum, item) => sum + item.estimatedFeeLocal, 0),
                      baseCurrency
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>예상 총 세금</span>
                  <span className="font-medium text-muted-foreground">
                    {formatAmount(
                      simulationResult.reduce((sum, item) => sum + item.estimatedTaxLocal, 0),
                      baseCurrency
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>실행 후 순증감</span>
                  <span className={`font-medium ${getProfitTextClass(
                    simulationResult.reduce((sum, item) => sum + item.netImpactLocal, 0),
                    { zeroAsNeutral: true }
                  )}`}>
                    {simulationResult.reduce((sum, item) => sum + item.netImpactLocal, 0) >= 0 ? '+' : ''}
                    {formatAmount(
                      simulationResult.reduce((sum, item) => sum + item.netImpactLocal, 0),
                      baseCurrency
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function normalizeGrowthScore(returnRate: number): number {
  if (!Number.isFinite(returnRate)) {
    return 0.5;
  }
  const clamped = Math.max(Math.min(returnRate, 60), -30);
  return (clamped + 30) / 90;
}

function normalizeStabilityScore(returnRate: number, profitLoss: number): number {
  if (!Number.isFinite(returnRate) || !Number.isFinite(profitLoss)) {
    return 0.5;
  }
  const returnScore = 1 - Math.abs(returnRate) / 100;
  const profitScore = profitLoss >= 0 ? 0.6 : 0.2;
  return Math.max(0, Math.min(1, returnScore * 0.7 + profitScore * 0.3));
}


