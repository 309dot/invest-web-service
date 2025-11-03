"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Cell } from 'recharts';

interface TopContributorsChartProps {
  data: PortfolioAnalysis['topContributors'];
  valueFormatter: (value: number) => string;
}

export function TopContributorsChart({ data, valueFormatter }: TopContributorsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>수익 기여도 Top 5</CardTitle>
        <CardDescription>수익에 가장 많이 기여한 종목</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">표시할 기여도가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="symbol" />
              <YAxis />
              <Tooltip formatter={(value: number) => valueFormatter(value as number)} />
              <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`bar-${entry.symbol}-${index}`} fill={entry.contribution >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

