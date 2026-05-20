'use client';

// app/ui/dashboard/cash-flow-chart.tsx

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import DashboardCard from '@/app/ui/dashboard/dashboard-card';

export type CashFlowRow = {
  month:             string;
  sales:             number;
  payments:          number;
  expenses:          number;
  supplier_payments: number; // already converted to EGP by caller
};

function fmt(n: number) {
  if (n >= 1_000_000) return `E£ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `E£ ${(n / 1_000).toFixed(1)}K`;
  return `E£ ${n}`;
}

const LINES: { key: keyof CashFlowRow; label: string; color: string; dashed?: boolean }[] = [
  { key: 'sales',label: 'Invoiced',color: '#7E22CE'  },
  { key: 'payments',label: 'Collected',color: '#C09300', dashed: true },
  { key: 'expenses',label: 'Expenses',color: '#2563eb'  },
  { key: 'supplier_payments', label: 'Supplier Payments (≈ E£)', color: '#ef4444', dashed: true },
];

export default function CashFlowChart({ data }: { data: CashFlowRow[] }) {
  const hasData = data.some((d) =>
    d.sales > 0 || d.payments > 0 || d.expenses > 0 || d.supplier_payments > 0
  );

  return (
    <DashboardCard title="Net Cash Flow · Last 12 Months">
      {!hasData ? (
        <p className="py-8 text-center text-sm text-gray-300">No data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
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
              formatter={(value, name) => {
                const line = LINES.find((l) => l.key === name);
                return [
                  `E£ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                  line?.label ?? String(name),
                ];
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            />
            <Legend
              formatter={(value) => LINES.find((l) => l.key === value)?.label ?? value}
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            />
            {LINES.map(({ key, color, dashed }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dashed ? '5 3' : undefined}
                dot={{ r: 3, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </DashboardCard>
  );
}
