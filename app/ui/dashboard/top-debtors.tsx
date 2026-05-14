// app/ui/dashboard/top-debtors.tsx

import Link                    from 'next/link';
import DashboardCard           from '@/app/ui/dashboard/dashboard-card';
import type { CustomerDebt }   from '@/app/lib/db/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardTopDebtors({
  debtors,
}: {
  debtors: CustomerDebt[];
}) {
  const maxDebt = Math.max(...debtors.map((d) => Number(d.amount_owed)), 1);

  return (
    <DashboardCard title="Outstanding Customer Balances">
      {debtors.length === 0 && (
        <p className="text-sm text-gray-300">No outstanding balances.</p>
      )}
      <div className="space-y-3">
        {debtors.map((d, i) => (
          <Link
            key={d.id}
            href={`/dashboard/customers/${d.id}`}
            className="block hover:opacity-75 transition-opacity"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{d.name}</p>
                  {d.email && <p className="text-xs text-gray-400">{d.email}</p>}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-amber-600">
                E£ {fmt(Number(d.amount_owed))}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full bg-amber-400"
                style={{ width: `${(Number(d.amount_owed) / maxDebt) * 100}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}