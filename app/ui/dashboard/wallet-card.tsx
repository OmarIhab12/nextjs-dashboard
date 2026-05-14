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
}: {
  egpBalance: number;
  usdBalance: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* EGP */}
      <Link href="/dashboard/wallet"
        className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5 hover:bg-gray-100 transition-colors">
        <div className="rounded-full bg-white p-3 shadow-sm">
          <WalletIcon className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">EGP Balance</p>
          <p className="text-2xl font-bold tabular-nums text-gray-800">
            E£ {fmt(egpBalance)}
          </p>
        </div>
      </Link>

      {/* USD */}
      <Link href="/dashboard/wallet"
        className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 hover:bg-blue-100 transition-colors">
        <div className="rounded-full bg-white p-3 shadow-sm">
          <WalletIcon className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-400">USD Balance</p>
          <p className="text-2xl font-bold tabular-nums text-blue-700">
            ${fmt(usdBalance)}
          </p>
        </div>
      </Link>
    </div>
  );
}