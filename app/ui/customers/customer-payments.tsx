'use client';

import { useState, useTransition } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { addCustomerPaymentAction } from '@/app/lib/actions/customers';
import type { CustomerPaymentSummary } from '@/app/lib/db/customers';
import { TableContainer, TableRows, TableEmpty } from '@/app/ui/table-components';

type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'check' | 'other';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash',          label: 'Cash'          },
  { value: 'card',          label: 'Card'          },
  { value: 'check',         label: 'Check'         },
  { value: 'other',         label: 'Other'         },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CustomerPayments({
  customerId,
  payments,
  totalOwed,
}: {
  customerId: string;
  payments:   CustomerPaymentSummary[];
  totalOwed:  number;
}) {
    const [showForm,   setShowForm]   = useState(false);
    const [amount,     setAmount]     = useState('');
    const [method,     setMethod]     = useState<PaymentMethod>('bank_transfer');
    const [reference,  setReference]  = useState('');
    const [error,      setError]      = useState<string | null>(null);
    const [isPending,  startTransition] = useTransition();
    const COLS = 'grid-cols-[1fr_1fr_8rem]';

    const handleSubmit = () => {
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) { setError('Enter a valid amount.'); return; }
        if (parsed > totalOwed) {
            setError(`Amount exceeds outstanding balance ($${fmt(totalOwed)}).`);
            return;
        }

        startTransition(async () => {
            const fd = new FormData();
            fd.set('amount',         String(parsed));
            fd.set('payment_method', method);
            fd.set('reference',      reference);

            const result = await addCustomerPaymentAction(customerId, fd);
            if (result.error) { setError(result.error); return; }

            // Just reset the form — server revalidation handles the rest
            setAmount(''); setMethod('bank_transfer'); setReference('');
            setShowForm(false); setError(null);
        });
    };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Payments</h3>
        {totalOwed > 0 && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Add payment
          </button>
        )}
      </div>

      {/* Outstanding balance */}
      {totalOwed > 0 && (
        <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700">
          Outstanding balance: <span className="font-semibold">${fmt(totalOwed)}</span>
        </div>
      )}

      {/* Add payment form */}
      {showForm && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">New Payment</p>

          <div className="grid grid-cols-2 gap-3">
            {/* Amount */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">Amount</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input
                  type="number" min={0} step="0.01"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  placeholder="0.00"
                  className="block w-full rounded-md border border-gray-200 py-1.5 pl-5 pr-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="mb-1 block text-xs text-gray-500">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="block w-full rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-none focus:border-gray-400"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="mb-1 block text-xs text-gray-500">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Bank transfer ID, check number…"
              className="block w-full rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-none focus:border-gray-400"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-md px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Saving…' : 'Save payment'}
            </button>
          </div>
        </div>
      )}

      {/* Payments table */}
      <TableContainer>
        <div className={`grid ${COLS} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
            <span>Date</span>
            <span>Method</span>
            <span className="text-right">Amount</span>
        </div>
        <TableRows>
          {payments.length === 0 && <TableEmpty message="No payments yet." />}
          {payments.map((p) => (
            <div className={`grid ${COLS} items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors`}>
                <span className="text-sm text-gray-500">{fmtDate(p.paid_at)}</span>
                <span className="text-sm text-gray-500 capitalize">
                    {p.payment_method?.replace('_', ' ') ?? '—'}
                </span>
                <span className="text-right text-sm font-medium tabular-nums text-gray-800">
                    ${fmt(Number(p.amount))}
                </span>
            </div>
          ))}
        </TableRows>
      </TableContainer>
    </div>
  );
}