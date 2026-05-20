// app/ui/dashboard/top-customers.tsx

import Link                    from 'next/link';
import DashboardCard           from '@/app/ui/dashboard/dashboard-card';
import type { CustomerDebt, TopCustomer }   from '@/app/lib/db/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardTopCustomers({
  customers,
}: {
  customers: TopCustomer[];
}) {
  const maxPurchase = Math.max(...customers.map((b) => Number(b.total)), 1);

  return (
    <DashboardCard title="Highest Customer Sales">
      {customers.length === 0 && (
        <p className="text-sm text-gray-300">No outstanding balances.</p>
      )}
      <div className="space-y-3">
        {customers.map((b, i) => (
          <Link
            key={b.id}
            href={`/dashboard/customers/${b.id}`}
            className="block hover:opacity-75 transition-opacity"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">#{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{b.name}</p>
                  {b.email && <p className="text-xs text-gray-400">{b.email}</p>}
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums" style={{ color: '#C09300' }}>
                E£ {fmt(Number(b.total))}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-gray-100">
              <div
                className="h-1.5 rounded-full" 
                style={{ width: `${(Number(b.total) / maxPurchase) * 100}%`, backgroundColor: '#C09300' }}
              />
            </div>
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}