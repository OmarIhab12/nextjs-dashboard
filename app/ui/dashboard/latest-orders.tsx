'use client';

// app/ui/dashboard/latest-orders.tsx

import Link                   from 'next/link';
import DashboardCard          from '@/app/ui/dashboard/dashboard-card';
import type { DashboardOrder } from '@/app/lib/db/dashboard';
import { OrderStatusUI } from '../shared/status';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-50 text-blue-700',
  shipped:   'bg-purple-50 text-purple-700',
  arrived:   'bg-amber-50 text-amber-700',
  stored:    'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-500',
};

const COLS = 'grid-cols-[2fr_1fr_1fr_1fr]';

export default function DashboardLatestOrders({
  orders,
}: {
  orders: DashboardOrder[];
}) {
  return (
    <DashboardCard title="Latest Orders">
      {/* Header — same structure as invoices */}
      <div className={`grid ${COLS} gap-2 border-b border-gray-50 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
        <span>Supplier</span>
        <span>Date</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>

      {orders.length === 0 && (
        <p className="mt-4 text-sm text-gray-300">No orders yet.</p>
      )}

      <div className="divide-y divide-gray-50">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/dashboard/orders/${order.id}/edit`}
            className={`grid ${COLS} items-center gap-2 py-2.5 hover:opacity-75 transition-opacity`}
          >
            <p className="truncate text-sm font-medium text-gray-800">
              {order.supplier_name ?? <span className="text-gray-300">—</span>}
            </p>
            <span className="text-xs text-gray-500">{fmtDate(order.order_date)}</span>
            <span>
              <OrderStatusUI status={order.status as any} />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-gray-700">
              ${fmt(Number(order.total_usd))}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 border-t border-gray-50 pt-3">
        <Link href="/dashboard/orders" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
          View all orders →
        </Link>
      </div>
    </DashboardCard>
  );
}