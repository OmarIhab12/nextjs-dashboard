// app/ui/dashboard/inventory-card.tsx

import { ArchiveBoxIcon, CubeIcon, TagIcon } from '@heroicons/react/24/outline';
import StatCard from './stat-card';
import type { InventorySummary } from '@/app/lib/db/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtInt(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

export default function InventoryCard({ inventory }: { inventory: InventorySummary }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard href="/dashboard/products" icon={TagIcon} color="orange"
        title="Inventory Value" value={`E£ ${fmt(inventory.total_value)}`} />
      <StatCard href="/dashboard/products" icon={CubeIcon} color="blue"
        title="Units in Stock" value={fmtInt(inventory.total_units)} />
      <StatCard href="/dashboard/products" icon={ArchiveBoxIcon} color="purple"
        title="Active Products" value={fmtInt(inventory.total_products)} />
    </div>
  );
}
