"use client";

import { useMemo, useState, useRef, useEffect } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartDataPoint } from '@/types';
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/formatters';
import { ShoppingCart, Maximize2, Minimize2 } from 'lucide-react';

interface PriceChartProps {
  data: ChartDataPoint[];
  purchasePoints?: { date: string; price: number; shares: number }[];
  showPurchaseMarkers?: boolean;
}

type Period = '7d' | '30d' | '90d' | 'all';

export function PriceChart({ data, purchasePoints = [], showPurchaseMarkers = false }: PriceChartProps) {
  const [period, setPeriod] = useState<Period>('30d');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // 터치 제스처 지원
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return data;
    }

    return data.filter(item => new Date(item.date) >= startDate);
  }, [data, period]);

  // 터치 스와이프 핸들러
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);
    
    if (isHorizontalSwipe && Math.abs(distanceX) > 50) {
      // 왼쪽 스와이프 (더 짧은 기간)
      if (distanceX > 0) {
        if (period === 'all') setPeriod('90d');
        else if (period === '90d') setPeriod('30d');
        else if (period === '30d') setPeriod('7d');
      }
      // 오른쪽 스와이프 (더 긴 기간)
      else {
        if (period === '7d') setPeriod('30d');
        else if (period === '30d') setPeriod('90d');
        else if (period === '90d') setPeriod('all');
      }
    }
  };

  // 풀스크린 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      chartRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 풀스크린 변경 감지
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover text-popover-foreground p-3 rounded-lg border shadow-lg">
          <p className="text-sm font-medium mb-2">{formatDate(data.date, 'yyyy-MM-dd')}</p>
          <div className="space-y-1 text-sm">
            <p>주가: {formatCurrency(data.price)}</p>
            <p className={data.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}>
              수익률: {formatPercent(data.returnRate)}
            </p>
            <p>평가액: {formatCurrency(data.totalValue)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card ref={chartRef}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>투자 추이</CardTitle>
            {showPurchaseMarkers && purchasePoints.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3" />
                매수 {purchasePoints.length}회
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden md:flex"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            variant={period === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('7d')}
          >
            7일
          </Button>
          <Button
            variant={period === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('30d')}
          >
            30일
          </Button>
          <Button
            variant={period === '90d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('90d')}
          >
            90일
          </Button>
          <Button
            variant={period === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod('all')}
          >
            전체
          </Button>
        </div>
      </CardHeader>
      <CardContent
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Tabs defaultValue="price" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="price">주가 추이</TabsTrigger>
            <TabsTrigger value="return">수익률 추이</TabsTrigger>
          </TabsList>

          <TabsContent value="price" className="mt-6">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => formatDate(date, 'MM/dd')}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(value) => `$${value}`}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorPrice)"
                  strokeWidth={2}
                />
                {/* 매수 포인트 마커 */}
                {showPurchaseMarkers && purchasePoints.map((point, index) => (
                  <ReferenceDot
                    key={index}
                    x={point.date}
                    y={point.price}
                    r={6}
                    fill="#10b981"
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="return" className="mt-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => formatDate(date, 'MM/dd')}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  className="text-xs"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="returnRate"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
