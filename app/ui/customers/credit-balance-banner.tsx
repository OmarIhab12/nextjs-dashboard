// app/ui/customers/credit-balance-banner.tsx
'use client';

import { useState, useTransition } from 'react';
import { refundCustomerCreditAction } from '@/app/lib/actions/customers';
import { formatCurrencyEGP } from '@/app/lib/utils';
import type { WalletAccount } from '@/app/lib/db/wallet-accounts';

export default function CreditBalanceBanner({
  customerId,
  creditBalance,
  egpAccounts,
}: {
  customerId:    string;
  creditBalance: number;
  egpAccounts:   WalletAccount[];
}) {
  const [showForm,  setShowForm]  = useState(false);
  const [amount,    setAmount]    = useState('');
  const [accountId, setAccountId] = useState('');
  const [notes,     setNotes]     = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0)       { setError('Enter a valid amount.'); return; }
    if (parsed > creditBalance)       { setError('Amount exceeds available credit balance.'); return; }
    if (!accountId)                   { setError('Select which account the cash will be paid from.'); return; }

    startTransition(async () => {
      const fd = new FormData();
      fd.set('amount',     String(parsed));
      fd.set('account_id', accountId);
      fd.set('notes',      notes);

      const result = await refundCustomerCreditAction(customerId, fd);
      if (result.error) { setError(result.error); return; }

      setAmount(''); setAccountId(''); setNotes(''); setShowForm(false); setError(null);
    });
  };

  if (creditBalance <= 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-yellow-800">Available Credit Balance</p>
          <p className="text-xs text-yellow-600 mt-0.5">
            This credit will automatically be applied to the customer&apos;s next invoice.
          </p>
        </div>
        <span className="text-xl font-bold tabular-nums text-yellow-700">
          {formatCurrencyEGP(creditBalance)}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-yellow-800">Available Credit Balance</p>
          <p className="text-xs text-yellow-600 mt-0.5">
            This credit will automatically be applied to the customer&apos;s next invoice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tabular-nums text-yellow-700">
            {formatCurrencyEGP(creditBalance)}
          </span>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md border border-yellow-400 bg-white px-3 py-1.5 text-xs font-medium text-yellow-800 hover:bg-yellow-100 transition-colors"
          >
            Refund
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mt-3 space-y-3 rounded-md border border-yellow-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-500">Amount</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  E£
                </span>
                <input
                  type="number" min={0} max={creditBalance} step="0.01"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }}
                  placeholder="0.00"
                  className="block w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-sm outline-none focus:border-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-gray-500">Pay from account</label>
              <select
                value={accountId}
                onChange={(e) => { setAccountId(e.target.value); setError(null); }}
                className="block w-full rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-none focus:border-gray-400"
              >
                <option value="" disabled>Select an EGP account…</option>
                {egpAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.method} — balance: {formatCurrencyEGP(Number(acc.balance))}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for the refund…"
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
              {isPending ? 'Refunding…' : 'Confirm refund'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
