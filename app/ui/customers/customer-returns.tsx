// app/ui/customers/customer-returns.tsx

import { getReturnsByInvoice } from '@/app/lib/db/returns';
import sql from '@/app/lib/db';
import TransactionList, { fmt, fmtDate } from '@/app/ui/shared/transaction-list';

type CustomerReturnRow = {
  id: string;
  invoice_id: string;
  credit_amount: string;
  resolution_type: string;
  reason: string | null;
  created_at: Date;
};

async function getReturnsByCustomer(customerId: string): Promise<CustomerReturnRow[]> {
  return sql<CustomerReturnRow[]>`
    SELECT
      r.id,
      r.invoice_id,
      r.credit_amount,
      r.resolution_type,
      r.reason,
      r.created_at
    FROM returns r
    JOIN invoices inv ON inv.id = r.invoice_id
    WHERE inv.customer_id = ${customerId}
    ORDER BY r.created_at DESC
  `;
}

const COLS = 'grid-cols-[1fr_1fr_1fr_1fr]';

export default async function CustomerReturns({
  customerId,
  totalCredits,
}: {
  customerId:   string;
  totalCredits: number;
}) {
  const returns = await getReturnsByCustomer(customerId);

  return (
    <TransactionList
      title="Returns"
      count={returns.length}
      statCards={[
        { label: 'Total products returned', value: `E£${fmt(totalCredits)}` },
      ]}
      cols={COLS}
      headers={[
        { label: 'Date' },
        { label: 'Credit (EGP)', align: 'center' },
        { label: 'Resolution',   align: 'center' },
        { label: 'Reason' },
      ]}
      items={returns}
      emptyMessage="No returns yet."
      renderRow={(r) => (
        <>
          <span className="text-sm text-gray-500">{fmtDate(r.created_at)}</span>
          <span className="text-center text-sm font-semibold tabular-nums text-red-600">
            -E£{fmt(Number(r.credit_amount))}
          </span>
          <div className="flex justify-center">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                r.resolution_type === 'cash_refund'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {r.resolution_type === 'cash_refund' ? 'Cash Refund' : 'Credit Applied'}
            </span>
          </div>
          <span className="text-sm text-gray-400 truncate">
            {r.reason ?? '—'}
          </span>
        </>
      )}
    />
  );
}
