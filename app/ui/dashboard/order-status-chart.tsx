'use client';

// app/ui/dashboard/order-status-chart.tsx

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardCard from '@/app/ui/dashboard/dashboard-card';
import type { OrderStatusItem } from '@/app/lib/db/dashboard';

const STATUS_COLORS: Record<string, string> = {
  ordered:  '#3b82f6',
  shipped:  '#8b5cf6',
  arrived:  '#f97316',
  stored:   '#22c55e',
};

const FALLBACK_COLORS = ['#6b7280', '#a1a1aa', '#d4d4d8'];

function getColor(status: string, index: number) {
  return STATUS_COLORS[status] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function OrderStatusChart({ data }: { data: OrderStatusItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <DashboardCard title="Orders by Status">
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-300">No orders yet.</p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
              >
                {data.map((entry, i) => (
                  <Cell key={entry.status} fill={getColor(entry.status, i)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${value} orders (${Math.round((Number(value) / total) * 100)}%)`,
                  capitalize(String(name)),
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Legend
                formatter={(value) => capitalize(value)}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashboardCard>
  );
}
