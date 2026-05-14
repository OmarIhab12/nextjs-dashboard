'use client';

// app/ui/dashboard/top-products.tsx

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import DashboardCard       from '@/app/ui/dashboard/dashboard-card';
import type { TopProduct } from '@/app/lib/db/dashboard';

function fmt(n: number) {
  if (n >= 1_000_000) return `E£ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `E£ ${(n / 1_000).toFixed(1)}K`;
  return `E£ ${n}`;
}

export default function DashboardTopProducts({
  products,
}: {
  products: TopProduct[];
}) {
  // Recharts needs short labels — truncate long names
  const data = products.map((p) => ({
    name:     p.product_name.length > 14 ? p.product_name.slice(0, 12) + '…' : p.product_name,
    fullName: p.product_name,
    quantity: p.total_quantity,
    revenue:  Number(p.total_revenue),
  }));

  return (
    <DashboardCard title="Top Products · Last 6 Months">
      {products.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-300">No sales data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={fmt}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
            <Tooltip
              formatter={(value, name) => [
                name === 'revenue'
                  ? `E£ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                  : `${value} units`,
                name === 'revenue' ? 'Revenue' : 'Qty sold',
              ]}
              labelFormatter={(label, payload) =>
                payload?.[0]?.payload?.fullName ?? label
              }
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Bar
              dataKey="revenue"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
              name="revenue"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}