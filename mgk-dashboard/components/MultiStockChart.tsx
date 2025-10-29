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
import { formatDate, formatPercent, formatCurrency } from '@/lib/utils/formatters';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import type { Position } from '@/types';

interface MultiStockChartProps {
  positions: Position[];
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

export function MultiStockChart({ positions }: MultiStockChartProps) {
  const [period, setPeriod] = useState<Period>('1m');
  const [visibleStocks, setVisibleStocks] = useState<Set<string>>(
    new Set(positions.map(p => p.symbol))
  );
  const [chartType, setChartType] = useState<'price' | 'return'>('return');

  // 차트 데이터 생성 (정규화된 수익률)
  const chartData = useMemo(() => {
    if (positions.length === 0) return [];

    // 기간 계산
    const now = new Date();
    let daysAgo = 30;
    switch (period) {
      case '7d': daysAgo = 7; break;
      case '1m': daysAgo = 30; break;
      case '3m': daysAgo = 90; break;
      case '6m': daysAgo = 180; break;
      case '1y': daysAgo = 365; break;
      case 'all': daysAgo = 365 * 10; break;
    }

    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // 날짜별 데이터 포인트 생성
    const dataPoints: { [key: string]: any } = {};
    
    positions.forEach((position) => {
      if (!position.priceHistory) return;

      const startPrice = position.averagePrice;
      
      position.priceHistory.forEach((point) => {
        const date = new Date(point.date);
        if (date < startDate) return;

        const dateKey = formatDate(date, 'yyyy-MM-dd');
        
        if (!dataPoints[dateKey]) {
          dataPoints[dateKey] = { date: dateKey };
        }

        // 정규화된 수익률 계산 (100 기준)
        if (chartType === 'return') {
          const returnRate = ((point.price - startPrice) / startPrice) * 100;
          dataPoints[dateKey][position.symbol] = returnRate;
        } else {
          dataPoints[dateKey][position.symbol] = point.price;
        }
      });
    });

    // 날짜순 정렬
    return Object.values(dataPoints).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [positions, period, chartType]);

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
                  {chartType === 'return' 
                    ? formatPercent(item.value)
                    : formatCurrency(item.value, 'USD')
                  }
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
                    {position.unrealizedReturnRate >= 0 ? (
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
                  chartType === 'return' ? `${value.toFixed(1)}%` : `$${value}`
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
        {visibleStocks.size > 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3">현재 성과</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {positions
                .filter(p => visibleStocks.has(p.symbol))
                .map((position, index) => {
                  const color = CHART_COLORS[index % CHART_COLORS.length];
                  return (
                    <div key={position.symbol} className="text-sm">
                      <div 
                        className="font-semibold mb-1"
                        style={{ color }}
                      >
                        {position.symbol}
                      </div>
                      <div className={`font-medium ${
                        position.unrealizedReturnRate >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {formatPercent(position.unrealizedReturnRate)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatCurrency(position.totalValue, 'USD')}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

