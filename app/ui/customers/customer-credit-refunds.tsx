// app/ui/customers/customer-credit-refunds.tsx

import { getCreditRefundsByCustomer } from '@/app/lib/db/customers';
import TransactionList, { fmt, fmtDate } from '@/app/ui/shared/transaction-list';

const COLS = 'grid-cols-[1fr_1fr_1fr_2fr]';

export default async function CustomerCreditRefunds({
  customerId,
}: {
  customerId: string;
}) {
  const refunds = await getCreditRefundsByCustomer(customerId);

  return (
    <TransactionList
      title="Credit Refunds"
      count={refunds.length}
      cols={COLS}
      headers={[
        { label: 'Date' },
        { label: 'Amount (EGP)', align: 'center' },
        { label: 'Paid from',    align: 'center' },
        { label: 'Notes' },
      ]}
      items={refunds}
      emptyMessage="No credit refunds yet."
      renderRow={(r) => (
        <>
          <span className="text-sm text-gray-500">{fmtDate(r.created_at)}</span>
          <span className="text-center text-sm font-semibold tabular-nums text-orange-600">
            -E£{fmt(Number(r.amount))}
          </span>
          <div className="flex justify-center">
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 capitalize">
              {r.account_method.replace('_', ' ')}
            </span>
          </div>
          <span className="text-sm text-gray-400 truncate">
            {r.notes ?? '—'}
          </span>
        </>
      )}
    />
  );
}
