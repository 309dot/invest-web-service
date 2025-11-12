"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioAnalysis } from '@/lib/services/portfolio-analysis';
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, Line, Cell, Legend } from 'recharts';

interface TopContributorsChartProps {
  data: PortfolioAnalysis['topContributors'];
  valueFormatter: (value: number) => string;
}

export function TopContributorsChart({ data, valueFormatter }: TopContributorsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>수익 기여도 Top 5</CardTitle>
        <CardDescription>수익 기여와 비중, 수익률을 함께 비교합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">표시할 기여도가 없습니다.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tickFormatter={(value) => valueFormatter(value as number)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(value) => `${(value as number).toFixed(1)}%`}
                />
                <Tooltip
                  formatter={(value: number, name) =>
                    name === 'portfolioWeight'
                      ? `${(value as number).toFixed(2)}%`
                      : valueFormatter(value as number)
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="contribution" name="기여 금액" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`bar-${entry.symbol}-${index}`}
                      fill={entry.contribution >= 0 ? '#22c55e' : '#ef4444'}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="weight"
                  name="포트폴리오 비중"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 px-2 text-left">종목</th>
                    <th className="py-2 px-2 text-right">기여 금액</th>
                    <th className="py-2 px-2 text-right">비중</th>
                    <th className="py-2 px-2 text-right">수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.symbol} className="border-b last:border-none">
                      <td className="py-2 px-2 font-semibold">{item.symbol}</td>
                      <td className={`py-2 px-2 text-right font-medium ${item.contribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {valueFormatter(item.contribution)}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {item.weight.toFixed(2)}%
                      </td>
                      <td className={`py-2 px-2 text-right ${item.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.returnRate.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

