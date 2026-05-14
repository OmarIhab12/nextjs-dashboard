// app/ui/suppliers/supplier-orders.tsx

import TransactionList, { fmt, fmtDate } from '@/app/ui/shared/transaction-list';
import type { Order, OrderWithPaymentStatus } from '@/app/lib/db/orders';
import { PaymentStatus } from '../shared/status';

const COLS = 'grid-cols-[1fr_1fr_1fr_6rem]';

export default function SupplierOrders({
  orders,
  totalOrdered,
  totalPaid,
}: {
  orders:       OrderWithPaymentStatus[];
  totalOrdered: number;
  totalPaid:    number;
}) {
  return (
    <TransactionList
      title="Orders"
      count={orders.length}
      statCards={[
        { label: 'Total ordered', value: `$${fmt(totalOrdered)}` },
        { label: 'Total paid',    value: `$${fmt(totalPaid)}`,    accent: true },
      ]}
      cols={COLS}
      headers={[
        { label: 'Date' },
        { label: 'Total (USD)', align: 'center' },
        { label: 'Paid (USD)',  align: 'center' },
        { label: 'Status',     align: 'center' },
      ]}
      items={orders}
      emptyMessage="No orders yet."
      renderRow={(o) => (
        <>
          <span className="text-sm text-gray-500">{fmtDate(o.order_date)}</span>
          <span className="text-center text-sm font-medium tabular-nums text-gray-800">
            ${fmt(Number(o.total_usd))}
          </span>
          <span className="text-center text-sm tabular-nums text-gray-500">
            ${fmt(Number(o.paid_usd))}
          </span>
          <div className="flex justify-center">
            <PaymentStatus status={o.payment_status} />
          </div>
        </>
      )}
    />
  );
}
