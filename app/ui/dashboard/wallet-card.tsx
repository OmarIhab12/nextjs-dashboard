// app/ui/dashboard/wallet-card.tsx

import { WalletIcon } from '@heroicons/react/24/outline';
import StatCard from './stat-card';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

export default function DashboardWallet({
  egpBalance, usdBalance, rmbBalance,
}: {
  egpBalance: number;
  usdBalance: number;
  rmbBalance: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard href="/dashboard/wallet" icon={WalletIcon} color="gold"
        title="EGP Balance" value={`E£ ${fmt(egpBalance)}`} />
      <StatCard href="/dashboard/wallet" icon={WalletIcon} color="green"
        title="USD Balance" value={`$${fmt(usdBalance)}`} />
      <StatCard href="/dashboard/wallet" icon={WalletIcon} color="red"
        title="RMB Balance" value={`¥${fmt(rmbBalance)}`} />
    </div>
  );
}
