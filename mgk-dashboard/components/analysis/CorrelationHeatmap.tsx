"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { useMemo } from 'react';

interface CorrelationHeatmapProps {
  series: PortfolioAnalysis['performanceSummary']['positionSeries'];
}

function computeDailyReturns(series: { date: string; price: number }[]) {
  const returns = new Map<string, number>();
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const current = series[i];
    if (!prev || !current || prev.price <= 0) continue;
    const change = (current.price - prev.price) / prev.price;
    returns.set(current.date, change);
  }
  return returns;
}

function calculateCorrelation(a: Map<string, number>, b: Map<string, number>): number | null {
  const commonDates: number[] = [];
  const valuesA: number[] = [];
  const valuesB: number[] = [];

  a.forEach((value, date) => {
    if (b.has(date)) {
      valuesA.push(value);
      valuesB.push(b.get(date)!);
      commonDates.push(1);
    }
  });

  if (valuesA.length < 3) {
    return null;
  }

  const meanA = valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length;
  const meanB = valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length;

  const covariance =
    valuesA.reduce((sum, value, index) => sum + (value - meanA) * (valuesB[index] - meanB), 0) /
    (valuesA.length - 1);

  const varianceA =
    valuesA.reduce((sum, value) => sum + (value - meanA) ** 2, 0) / (valuesA.length - 1);
  const varianceB =
    valuesB.reduce((sum, value) => sum + (value - meanB) ** 2, 0) / (valuesB.length - 1);

  if (varianceA === 0 || varianceB === 0) {
    return null;
  }

  return covariance / Math.sqrt(varianceA * varianceB);
}

function correlationToColor(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return 'bg-muted';
  }
  const clamped = Math.max(-1, Math.min(1, value));
  if (clamped >= 0) {
    const intensity = Math.round(clamped * 255);
    return `rgba(34, 197, 94, ${0.2 + clamped * 0.6})`;
  }
  const intensity = Math.round(Math.abs(clamped) * 255);
  return `rgba(239, 68, 68, ${0.2 + Math.abs(clamped) * 0.6})`;
}

export function CorrelationHeatmap({ series }: CorrelationHeatmapProps) {
  const correlationMatrix = useMemo(() => {
    if (!series || series.length === 0) {
      return { symbols: [], matrix: [] };
    }

    const symbols = series.map((item) => item.symbol);
    const returnsMap = new Map<string, Map<string, number>>();

    series.forEach((item) => {
      returnsMap.set(item.symbol, computeDailyReturns(item.series));
    });

    const matrix: (number | null)[][] = symbols.map(() => symbols.map(() => null));

    symbols.forEach((symbolA, i) => {
      symbols.forEach((symbolB, j) => {
        if (i === j) {
          matrix[i][j] = 1;
        } else if (i < j) {
          const returnsA = returnsMap.get(symbolA) ?? new Map();
          const returnsB = returnsMap.get(symbolB) ?? new Map();
          const correlation = calculateCorrelation(returnsA, returnsB);
          matrix[i][j] = correlation;
          matrix[j][i] = correlation;
        }
      });
    });

    return { symbols, matrix };
  }, [series]);

  if (!correlationMatrix.symbols.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>상관관계 히트맵</CardTitle>
          <CardDescription>충분한 가격 데이터를 찾을 수 없습니다.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>상관관계 히트맵</CardTitle>
        <CardDescription>종목 간 일일 수익률 상관관계를 시각화합니다.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs text-muted-foreground">종목</th>
              {correlationMatrix.symbols.map((symbol) => (
                <th key={`head-${symbol}`} className="p-2 text-xs text-muted-foreground">
                  {symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlationMatrix.symbols.map((symbolA, rowIndex) => (
              <tr key={`row-${symbolA}`}>
                <td className="p-2 text-xs font-semibold text-muted-foreground">{symbolA}</td>
                {correlationMatrix.symbols.map((symbolB, colIndex) => {
                  const value = correlationMatrix.matrix[rowIndex][colIndex];
                  return (
                    <td
                      key={`cell-${symbolA}-${symbolB}`}
                      className="p-2 text-center text-xs font-semibold text-foreground border"
                      style={{ backgroundColor: correlationToColor(value) }}
                    >
                      {value === null ? 'N/A' : value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">
          값이 +1에 가까울수록 동일한 방향으로 움직이며, -1에 가까울수록 반대로 움직입니다.
        </p>
      </CardContent>
    </Card>
  );
}

