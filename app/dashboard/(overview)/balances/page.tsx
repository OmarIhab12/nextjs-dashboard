// app/dashboard/(overview)/balances/page.tsx

import { lusitana }          from '@/app/ui/fonts';
import { getAllDebtors }      from '@/app/lib/db/dashboard';
import { BanknotesIcon, UsersIcon } from '@heroicons/react/24/outline';
import StatCard               from '@/app/ui/dashboard/stat-card';
import Link                   from 'next/link';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const COLS = 'grid-cols-[2rem_2fr_1fr]';

export default async function Page() {
  const debtors = await getAllDebtors();
  const total   = debtors.reduce((s, d) => s + Number(d.amount_owed), 0);
  const maxDebt = Math.max(...debtors.map((d) => Number(d.amount_owed)), 1);

  return (
    <div className="w-full">
      <h1 className={`${lusitana.className} mb-6 text-2xl`}>Outstanding Balances</h1>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          href="/dashboard/balances"
          icon={BanknotesIcon}
          color="orange"
          title="Total Outstanding"
          value={`E£ ${fmt(total)}`}
        />
        <StatCard
          href="/dashboard/balances"
          icon={UsersIcon}
          color="orange"
          title="Customers with Balance"
          value={String(debtors.length)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className={`grid ${COLS} gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
          <span>#</span>
          <span>Customer</span>
          <span className="text-right">Amount Owed</span>
        </div>

        {debtors.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-300">
            No outstanding balances — all customers are paid up.
          </p>
        )}

        {debtors.map((d, i) => (
          <Link
            key={d.id}
            href={`/dashboard/customers/${d.id}`}
            className={`grid ${COLS} items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-orange-50/50 transition-colors`}
          >
            <span className="text-sm font-medium text-gray-400">{i + 1}</span>
            <p className="text-sm font-medium text-gray-800">{d.name}</p>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-semibold tabular-nums text-orange-600">
                E£ {fmt(Number(d.amount_owed))}
              </span>
              <div className="h-1.5 w-full max-w-[120px] rounded-full bg-orange-100">
                <div
                  className="h-1.5 rounded-full bg-orange-400"
                  style={{ width: `${(Number(d.amount_owed) / maxDebt) * 100}%` }}
                />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
