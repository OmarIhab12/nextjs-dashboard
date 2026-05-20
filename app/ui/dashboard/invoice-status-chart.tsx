'use client';

// app/ui/dashboard/invoice-status-chart.tsx

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardCard from '@/app/ui/dashboard/dashboard-card';
import type { OrderStatusItem } from '@/app/lib/db/dashboard';

const STATUS_COLORS: Record<string, string> = {
  paid:    '#22c55e',
  partial: '#f59e0b',
  pending: '#9ca3af',
  overdue: '#ef4444',
};

const LABELS: Record<string, string> = {
  paid:    'Paid',
  partial: 'Partially Paid',
  pending: 'Pending',
  overdue: 'Overdue',
};

export default function InvoiceStatusChart({ data }: { data: OrderStatusItem[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <DashboardCard title="Invoices by Payment Status">
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-300">No invoices yet.</p>
      ) : (
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
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${value} (${Math.round((Number(value) / total) * 100)}%)`,
                LABELS[String(name)] ?? String(name),
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              formatter={(value) => LABELS[value] ?? value}
              wrapperStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}
