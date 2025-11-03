"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils/formatters';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface AllocationDatum {
  id: string;
  label: string;
  value: number;
  percentage: number;
  returnRate: number;
}

interface AllocationPieChartProps {
  title: string;
  description?: string;
  data: AllocationDatum[];
  valueFormatter: (value: number) => string;
  colors?: string[];
  emptyMessage?: string;
}

const DEFAULT_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

export function AllocationPieChart({
  title,
  description,
  data,
  valueFormatter,
  colors = DEFAULT_COLORS,
  emptyMessage = '표시할 데이터가 없습니다.',
}: AllocationPieChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ label, percentage }) => `${label}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${entry.id}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => valueFormatter(value as number)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    />
                    <span className="capitalize">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{item.percentage.toFixed(1)}%</span>
                    <span className={item.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatPercent(item.returnRate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { DEFAULT_COLORS as DEFAULT_ALLOCATION_COLORS };

