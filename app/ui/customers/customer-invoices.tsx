// app/ui/customers/customer-invoices.tsx

import TransactionList, { fmt, fmtDate } from '@/app/ui/shared/transaction-list';
import { PaymentStatus } from '@/app/ui/shared/status';
import type { CustomerInvoiceSummary } from '@/app/lib/db/customers';

// Date | Original Cost | Returned | Payment Summary | Status
const COLS = 'grid-cols-[1.2fr_1fr_1fr_1.8fr_6rem]';

export default function CustomerInvoices({
  invoices,
  totalPaid,
  totalCredits,
  totalCashRefunded,
}: {
  invoices:          CustomerInvoiceSummary[];
  totalPaid:         number;
  totalCredits:      number;
  totalCashRefunded: number;
}) {
  const grandTotal = invoices.reduce((s, i) => s + Number(i.total), 0);
  const netCost    = grandTotal - totalCredits;
  const netPaid    = totalPaid - totalCashRefunded;

  return (
    <TransactionList
      title="Invoices"
      count={invoices.length}
      statCards={[
        { label: 'Net cost',       value: `E£${fmt(netCost)}` },
        { label: 'Net paid',       value: `E£${fmt(netPaid)}`, accent: true },
      ]}
      cols={COLS}
      headers={[
        { label: 'Date' },
        { label: 'Original Cost', align: 'center' },
        { label: 'Returned',      align: 'center' },
        { label: 'Payment Summary', align: 'center' },
        { label: 'Status',        align: 'center' },
      ]}
      items={invoices}
      emptyMessage="No invoices yet."
      renderRow={(inv) => {
        const original     = Number(inv.total);
        const returned     = Number(inv.total_credits);
        const cashRefunded = Number(inv.cash_refunded);
        const grossPaid    = Number(inv.paid);
        const netCostRow   = original - returned;
        const netPaidRow   = grossPaid;

        return (
          <>
            <span className="text-sm text-gray-500">{fmtDate(inv.created_at)}</span>

            {/* Original Cost */}
            <span className="text-center text-sm tabular-nums text-gray-700">
              E£{fmt(original)}
            </span>

            {/* Returned */}
            <span className="text-center text-sm tabular-nums text-red-500">
              {returned > 0 ? `-E£${fmt(returned)}` : '—'}
            </span>

            {/* Payment Summary: (paid - refunded) of (original - returned) */}
            <span className="text-center text-sm font-semibold tabular-nums text-gray-800">
              E£{fmt(netPaidRow)}
              <span className="font-normal text-gray-400"> of </span>
              E£{fmt(netCostRow)}
            </span>

            <div className="flex justify-center">
              <PaymentStatus status={inv.payment_status} />
            </div>
          </>
        );
      }}
    />
  );
}
