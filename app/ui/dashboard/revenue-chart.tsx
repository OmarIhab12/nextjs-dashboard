'use client';

// app/ui/dashboard/revenue-chart.tsx

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Dot,
} from 'recharts';
import DashboardCard        from '@/app/ui/dashboard/dashboard-card';
import type { MonthlySales } from '@/app/lib/db/dashboard';

function fmt(n: number) {
  if (n >= 1_000_000) return `E£ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `E£ ${(n / 1_000).toFixed(1)}K`;
  return `E£ ${n}`;
}

export default function DashboardRevenueChart({
  data,
}: {
  data: MonthlySales[];
}) {
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <DashboardCard title="Monthly Sales · Last 12 Months">
      {!hasData ? (
        <p className="py-8 text-center text-sm text-gray-300">No sales data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 20, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              formatter={(value) => [
                `E£ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                'Revenue',
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: '#2563eb', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}