// app/ui/dashboard/wallet-card.tsx

import Link from 'next/link';
import { WalletIcon } from '@heroicons/react/24/outline';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardWallet({
  egpBalance,
  usdBalance,
  rmbBalance,
}: {
  egpBalance: number;
  usdBalance: number;
  rmbBalance: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* EGP */}
      <Link href="/dashboard/wallet"
        className="flex items-center gap-4 rounded-xl border border-yellow-200 bg-yellow-50 p-5 hover:bg-yellow-100 transition-colors">
        <div className="rounded-full bg-white p-3 shadow-sm">
          <WalletIcon className="h-5 w-5" style={{ color: '#C09300' }} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#C09300' }}>EGP Balance</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#C09300' }}>
            E£ {fmt(egpBalance)}
          </p>
        </div>
      </Link>

      {/* USD */}
      <Link href="/dashboard/wallet"
        className="flex items-center gap-4 rounded-xl border border-green-100 bg-green-50 p-5 hover:bg-green-100 transition-colors">
        <div className="rounded-full bg-white p-3 shadow-sm">
          <WalletIcon className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-green-500">USD Balance</p>
          <p className="text-2xl font-bold tabular-nums text-green-700">
            ${fmt(usdBalance)}
          </p>
        </div>
      </Link>

      {/* RMB */}
      <Link href="/dashboard/wallet"
        className="flex items-center gap-4 rounded-xl border border-red-100 bg-red-50 p-5 hover:bg-red-100 transition-colors">
        <div className="rounded-full bg-white p-3 shadow-sm">
          <WalletIcon className="h-5 w-5 text-red-500" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-400">RMB Balance</p>
          <p className="text-2xl font-bold tabular-nums text-red-700">
            ¥{fmt(rmbBalance)}
          </p>
        </div>
      </Link>
    </div>
  );
}