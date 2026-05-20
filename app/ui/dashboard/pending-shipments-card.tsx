// app/ui/dashboard/pending-shipments-card.tsx

import { TruckIcon, CubeIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import StatCard from './stat-card';
import type { PendingShipmentsSummary } from '@/app/lib/db/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtInt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

export default function PendingShipmentsCard({
  shipments, rmbToEgp,
}: {
  shipments: PendingShipmentsSummary;
  rmbToEgp:  number;
}) {
  const egpEquiv = rmbToEgp > 0
    ? <p className="text-xs text-orange-400 tabular-nums mt-0.5">≈ E£{fmt(shipments.total_rmb * rmbToEgp)}</p>
    : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard href="/dashboard/orders" icon={BanknotesIcon} color="orange"
        title="Capital in Transit" value={`¥${fmt(shipments.total_rmb)}`} sub={egpEquiv} />
      <StatCard href="/dashboard/orders" icon={CubeIcon} color="blue"
        title="Units in Transit" value={fmtInt(shipments.total_units)} />
      <StatCard href="/dashboard/orders" icon={TruckIcon} color="purple"
        title="Pending Orders" value={fmtInt(shipments.order_count)} />
      
    </div>
  );
}
