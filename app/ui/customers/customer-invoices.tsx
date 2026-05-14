// app/ui/customers/customer-invoices.tsx

import TransactionList, { fmt, fmtDate } from '@/app/ui/shared/transaction-list';
import { PaymentStatus } from '@/app/ui/shared/status';
import type { CustomerInvoiceSummary } from '@/app/lib/db/customers';

const COLS = 'grid-cols-[1fr_1fr_1fr_6rem]';

export default function CustomerInvoices({
  invoices,
  totalPaid,
}: {
  invoices:  CustomerInvoiceSummary[];
  totalPaid: number;
}) {
  const grandTotal = invoices.reduce((s, i) => s + Number(i.total), 0);

  return (
    <TransactionList
      title="Invoices"
      count={invoices.length}
      statCards={[
        { label: 'Total invoiced', value: `$${fmt(grandTotal)}` },
        { label: 'Total paid',     value: `$${fmt(totalPaid)}`,  accent: true },
      ]}
      cols={COLS}
      headers={[
        { label: 'Date' },
        { label: 'Total (EGP)',  align: 'center' },
        { label: 'Paid (EGP)',  align: 'center' },
        { label: 'Status', align: 'center' },
      ]}
      items={invoices}
      emptyMessage="No invoices yet."
      renderRow={(inv) => (
        <>
          <span className="text-sm text-gray-500">{fmtDate(inv.created_at)}</span>
          <span className="text-center text-sm font-medium tabular-nums text-gray-800">
            ${fmt(Number(inv.total))}
          </span>
          <span className="text-center text-sm tabular-nums text-gray-500">
            ${fmt(Number(inv.paid))}
          </span>
          <div className="flex justify-center">
            <PaymentStatus status={inv.payment_status} />
          </div>
        </>
      )}
    />
  );
}
