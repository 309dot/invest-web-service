/**
 * 다중 종목 비교 차트 컴포넌트
 * 
 * 여러 종목의 가격 추이를 동시에 비교
 */

"use client";

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatDate, formatPercent } from '@/lib/utils/formatters';
import { useCurrency } from '@/lib/contexts/CurrencyContext';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import type { Position, SupportedCurrency } from '@/types';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { assertCurrency, convertWithRate } from '@/lib/currency';

interface MultiStockChartProps {
  positions: Position[];
  series: PortfolioAnalysis['performanceSummary']['positionSeries'];
  baseCurrency: SupportedCurrency;
  exchangeRate?: number | null;
}

type Period = '7d' | '1m' | '3m' | '6m' | '1y' | 'all';

const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
];

export function MultiStockChart({ positions, series, baseCurrency, exchangeRate }: MultiStockChartProps) {
  const [period, setPeriod] = useState<Period>('1m');
  const [visibleStocks, setVisibleStocks] = useState<Set<string>>(
    new Set(positions.map(p => p.symbol))
  );
  const [chartType, setChartType] = useState<'price' | 'return'>('return');
  const { formatAmount } = useCurrency();
  const toBase = useMemo(() => {
    return (value: number, currency: SupportedCurrency) => {
      if (baseCurrency === 'KRW') {
        if (currency === 'KRW') return value;
        if (!exchangeRate) return value;
        return convertWithRate(value, 'USD', 'KRW', exchangeRate);
      }

      if (currency === 'USD') return value;
      if (!exchangeRate) return value;
      return convertWithRate(value, 'KRW', 'USD', exchangeRate);
    };
  }, [baseCurrency, exchangeRate]);

  const totalValueBase = useMemo(() => {
    return positions.reduce((sum, position) => {
      const currency = assertCurrency(position.currency, position.market === 'KR' ? 'KRW' : 'USD');
      return sum + toBase(position.totalValue, currency);
    }, 0);
  }, [positions, toBase]);

  const periodStartDate = useMemo(() => {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '1m':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '3m':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '6m':
        return new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'all':
      default:
        return new Date(now.getTime() - 365 * 5 * 24 * 60 * 60 * 1000);
    }
  }, [period]);

  // 차트 데이터 생성 (정규화된 수익률)
  const chartData = useMemo(() => {
    if (!series || series.length === 0) return [];

    const dataMap = new Map<string, Record<string, number>>();

    series.forEach((item) => {
      const filtered = item.series.filter((point) => {
        const pointDate = new Date(point.date);
        return pointDate >= periodStartDate;
      });

      if (filtered.length === 0) {
        return;
      }

      const basePrice = filtered[0].price;

      filtered.forEach((point) => {
        const dateKey = point.date;
        if (!dataMap.has(dateKey)) {
          dataMap.set(dateKey, { date: dateKey });
        }
        const entry = dataMap.get(dateKey)!;
        entry[item.symbol] =
          chartType === 'return'
            ? ((point.price - basePrice) / basePrice) * 100
            : point.price;
      });
    });

    return Array.from(dataMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [series, chartType, periodStartDate]);

  const performanceTable = useMemo(() => {
    if (!series || series.length === 0) return [];
    return series
      .map((item) => {
        const filtered = item.series.filter((point) => {
          const pointDate = new Date(point.date);
          return pointDate >= periodStartDate;
        });

        if (filtered.length < 2) return null;

        const startPrice = filtered[0].price;
        const endPrice = filtered[filtered.length - 1].price;
        const returnRate = ((endPrice - startPrice) / startPrice) * 100;

        const position = positions.find((p) => p.symbol === item.symbol);
        const currency = assertCurrency(position?.currency, position?.market === 'KR' ? 'KRW' : 'USD');
        const currentWeight =
          position && totalValueBase > 0
            ? (toBase(position.totalValue, currency) / totalValueBase) * 100
            : 0;

        return {
          symbol: item.symbol,
          currency: item.currency,
          startPrice,
          endPrice,
          returnRate,
          currentWeight,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.returnRate - a.returnRate);
  }, [series, positions, toBase, totalValueBase, periodStartDate]);

  const currencyBySymbol = useMemo(() => {
    const map = new Map<string, SupportedCurrency>();
    series?.forEach((item) => {
      map.set(item.symbol, item.currency);
    });
    return map;
  }, [series]);

  // 종목 토글
  const toggleStock = (symbol: string) => {
    const newVisible = new Set(visibleStocks);
    if (newVisible.has(symbol)) {
      newVisible.delete(symbol);
    } else {
      newVisible.add(symbol);
    }
    setVisibleStocks(newVisible);
  };

  // 전체 토글
  const toggleAll = () => {
    if (visibleStocks.size === positions.length) {
      setVisibleStocks(new Set());
    } else {
      setVisibleStocks(new Set(positions.map(p => p.symbol)));
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover text-popover-foreground p-3 rounded-lg border shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          <div className="space-y-1">
            {payload.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-3 text-sm">
                <span style={{ color: item.color }}>{item.name}:</span>
                <span className="font-medium">
                  {(() => {
                    if (chartType === 'return') {
                      return formatPercent(item.value);
                    }
                    const symbol = item.dataKey || item.name;
                    const currency = currencyBySymbol.get(symbol) ?? 'USD';
                    return formatAmount(item.value, currency);
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>다중 종목 비교</CardTitle>
            <CardDescription>
              보유 종목들의 성과를 한눈에 비교합니다
            </CardDescription>
          </div>

          {/* 차트 타입 선택 */}
          <div className="flex gap-2">
            <Button
              variant={chartType === 'return' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('return')}
            >
              수익률
            </Button>
            <Button
              variant={chartType === 'price' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('price')}
            >
              주가
            </Button>
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(['7d', '1m', '3m', '6m', '1y', 'all'] as Period[]).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p)}
            >
              {p === '7d' ? '7일' :
               p === '1m' ? '1개월' :
               p === '3m' ? '3개월' :
               p === '6m' ? '6개월' :
               p === '1y' ? '1년' : '전체'}
            </Button>
          ))}
        </div>

        {/* 종목 선택 */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAll}
          >
            {visibleStocks.size === positions.length ? (
              <>
                <EyeOff className="mr-1 h-3 w-3" />
                전체 숨김
              </>
            ) : (
              <>
                <Eye className="mr-1 h-3 w-3" />
                전체 표시
              </>
            )}
          </Button>
          {positions.map((position, index) => {
            const isVisible = visibleStocks.has(position.symbol);
            const color = CHART_COLORS[index % CHART_COLORS.length];
            
            return (
              <Badge
                key={position.symbol}
                variant={isVisible ? 'default' : 'outline'}
                className="cursor-pointer transition-all hover:scale-105"
                style={{
                  backgroundColor: isVisible ? color : 'transparent',
                  borderColor: color,
                  color: isVisible ? 'white' : color,
                }}
                onClick={() => toggleStock(position.symbol)}
              >
                {position.symbol}
                {isVisible && (
                  <span className="ml-1">
                    {position.returnRate >= 0 ? (
                      <TrendingUp className="inline h-3 w-3" />
                    ) : (
                      <TrendingDown className="inline h-3 w-3" />
                    )}
                  </span>
                )}
              </Badge>
            );
          })}
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            데이터가 없습니다. 종목별 가격 이력을 수집 중입니다.
          </div>
        ) : visibleStocks.size === 0 ? (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            표시할 종목을 선택해주세요.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => formatDate(date, 'MM/dd')}
                className="text-xs"
              />
              <YAxis
                tickFormatter={(value) =>
                  chartType === 'return' ? `${value.toFixed(1)}%` : value.toLocaleString()
                }
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
              />
              {positions.map((position, index) => {
                if (!visibleStocks.has(position.symbol)) return null;
                
                const color = CHART_COLORS[index % CHART_COLORS.length];
                
                return (
                  <Line
                    key={position.symbol}
                    type="monotone"
                    dataKey={position.symbol}
                    name={position.symbol}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* 성과 요약 */}
        {visibleStocks.size > 0 && performanceTable.length > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3">기간별 성과 요약</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-2 text-left">종목</th>
                    <th className="py-2 px-2 text-right">현재 비중</th>
                    <th className="py-2 px-2 text-right">기간 수익률</th>
                    <th className="py-2 px-2 text-right">시작가</th>
                    <th className="py-2 px-2 text-right">현재가</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceTable
                    .filter((item) => visibleStocks.has(item.symbol))
                    .map((item, index) => {
                      const color = CHART_COLORS[index % CHART_COLORS.length];
                      const isPositive = item.returnRate >= 0;
                      return (
                        <tr key={item.symbol} className="border-b last:border-none">
                          <td className="py-2 px-2 font-semibold" style={{ color }}>
                            {item.symbol}
                          </td>
                          <td className="py-2 px-2 text-right">
                            {item.currentWeight.toFixed(1)}%
                          </td>
                          <td
                            className={`py-2 px-2 text-right font-medium ${
                              isPositive ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {item.returnRate >= 0 ? '+' : ''}
                            {item.returnRate.toFixed(2)}%
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {formatAmount(item.startPrice, item.currency)}
                          </td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {formatAmount(item.endPrice, item.currency)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

