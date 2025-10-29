/**
 * 리밸런싱 시뮬레이터 컴포넌트
 * 
 * 목표 비중 설정 및 매수/매도 시뮬레이션
 */

"use client";

import { useState, useEffect } from 'react';
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
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import type { Position } from '@/types';

interface RebalancingSimulatorProps {
  positions: Position[];
  totalValue: number;
}

interface TargetWeight {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  currentValue: number;
  targetValue: number;
  difference: number;
  action: 'buy' | 'sell' | 'hold';
}

export function RebalancingSimulator({ positions, totalValue }: RebalancingSimulatorProps) {
  const [targetWeights, setTargetWeights] = useState<Record<string, string>>({});
  const [simulationResult, setSimulationResult] = useState<TargetWeight[]>([]);
  const [rebalanceMode, setRebalanceMode] = useState<'equal' | 'custom'>('equal');
  const [showResult, setShowResult] = useState(false);

  // 초기 가중치 설정
  useEffect(() => {
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      const currentWeight = totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0;
      weights[position.symbol] = currentWeight.toFixed(1);
    });
    setTargetWeights(weights);
  }, [positions, totalValue]);

  // 균등 분배 설정
  const handleEqualDistribution = () => {
    const equalWeight = positions.length > 0 ? (100 / positions.length).toFixed(1) : '0';
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      weights[position.symbol] = equalWeight;
    });
    setTargetWeights(weights);
    setRebalanceMode('equal');
  };

  // 현재 비중 유지
  const handleKeepCurrent = () => {
    const weights: Record<string, string> = {};
    positions.forEach((position) => {
      const currentWeight = totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0;
      weights[position.symbol] = currentWeight.toFixed(1);
    });
    setTargetWeights(weights);
    setRebalanceMode('custom');
  };

  // 가중치 변경
  const handleWeightChange = (symbol: string, value: string) => {
    setTargetWeights({
      ...targetWeights,
      [symbol]: value,
    });
    setRebalanceMode('custom');
  };

  // 시뮬레이션 실행
  const handleSimulate = () => {
    const results: TargetWeight[] = [];
    let totalTarget = 0;

    positions.forEach((position) => {
      const currentWeight = totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0;
      const targetWeight = parseFloat(targetWeights[position.symbol] || '0');
      const targetValue = (totalValue * targetWeight) / 100;
      const difference = targetValue - position.totalValue;

      totalTarget += targetWeight;

      let action: 'buy' | 'sell' | 'hold' = 'hold';
      if (Math.abs(difference) < totalValue * 0.01) { // 1% 이내면 유지
        action = 'hold';
      } else if (difference > 0) {
        action = 'buy';
      } else {
        action = 'sell';
      }

      results.push({
        symbol: position.symbol,
        currentWeight,
        targetWeight,
        currentValue: position.totalValue,
        targetValue,
        difference,
        action,
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
              const currentWeight = totalValue > 0 ? (position.totalValue / totalValue) * 100 : 0;
              return (
                <div key={position.symbol} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{position.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      현재: {currentWeight.toFixed(1)}% ({formatCurrency(position.totalValue, 'USD')})
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
                      <td className="py-2 px-2 text-right">{formatCurrency(result.currentValue, 'USD')}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatCurrency(result.targetValue, 'USD')}</td>
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
                        result.difference > 0 ? 'text-green-600' : 
                        result.difference < 0 ? 'text-red-600' : 
                        'text-muted-foreground'
                      }`}>
                        {result.difference >= 0 ? '+' : ''}{formatCurrency(result.difference, 'USD')}
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
                        <span className="font-medium">{formatCurrency(result.currentValue, 'USD')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">목표 금액</span>
                        <span className="font-medium">{formatCurrency(result.targetValue, 'USD')}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="font-semibold">차이</span>
                        <span className={`font-semibold ${
                          result.difference > 0 ? 'text-green-600' : 
                          result.difference < 0 ? 'text-red-600' : 
                          'text-muted-foreground'
                        }`}>
                          {result.difference >= 0 ? '+' : ''}{formatCurrency(result.difference, 'USD')}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

