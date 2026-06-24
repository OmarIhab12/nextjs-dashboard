'use client';

import { useState, useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/app/ui/button';
import { formatCurrencyEGP } from '@/app/lib/utils';
import type { InvoiceWithItems } from '@/app/lib/db/invoices';
import type { ReturnState, CreateReturnItemInput } from '@/app/lib/db/returns';
import type { WalletAccount } from '@/app/lib/db/wallet-accounts';

export default function ReturnForm({
  invoice,
  alreadyReturnedMap,
  invoiceTotalDue,
  invoiceTotalPaid,
  egpAccounts,
  action,
}: {
  invoice: InvoiceWithItems;
  alreadyReturnedMap: Record<string, number>;
  invoiceTotalDue: number;
  invoiceTotalPaid: number;
  egpAccounts: WalletAccount[];
  action: (prevState: ReturnState, formData: FormData) => Promise<ReturnState>;
}) {
  const initialState: ReturnState = { errors: {}, message: null };
  const [state, formAction] = useActionState(action, initialState);

  // Track return qty per invoice item
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>(
    Object.fromEntries(invoice.items.map((i) => [i.id, 0]))
  );

  const [resolutionType, setResolutionType] = useState<'credit' | 'cash_refund'>('credit');

  const updateQty = (itemId: string, value: number) => {
    setReturnQtys((prev) => ({ ...prev, [itemId]: value }));
  };

  // Invoice-level discount ratio: what fraction of the list price the customer actually paid.
  // e.g. 1800 total / 2000 subtotal = 0.9 → every item is effectively 10% cheaper.
  const subtotal = Number(invoice.subtotal);
  const invoiceTotal = Number(invoice.total);
  const discountRatio = subtotal > 0 ? invoiceTotal / subtotal : 1;
  const hasDiscount = discountRatio < 0.9999; // guard against floating point noise

  // Build the items payload using the effective (post-discount) unit price
  const returnItems: CreateReturnItemInput[] = invoice.items
    .filter((i) => (returnQtys[i.id] ?? 0) > 0)
    .map((i) => ({
      invoice_item_id: i.id,
      product_id: i.product_id ?? null,
      product_name: i.product_name,
      unit_price: parseFloat((Number(i.unit_price) * discountRatio).toFixed(2)),
      quantity: returnQtys[i.id],
    }));

  const creditAmount = returnItems.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0
  );

  // How much the customer would get back as cash if cash_refund is chosen.
  // Only the overpaid portion (paid > new_due) qualifies as a cash refund.
  const newDue         = invoiceTotalDue - creditAmount;
  const cashRefundable = Math.max(0, invoiceTotalPaid - newDue);
  const canCashRefund  = cashRefundable > 0;

  return (
    <form action={formAction}>
      {/* Hidden items payload */}
      <input type="hidden" name="items" value={JSON.stringify(returnItems)} />

      <div className="rounded-md bg-gray-50 p-4 md:p-6 space-y-6">

        {/* ── Item selection ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Select items to return</h2>
          {hasDiscount && (
            <p className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              A discount was applied to this invoice. Credit amounts reflect the discounted price the customer actually paid.
            </p>
          )}
          <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Product</th>
                  <th className="px-4 py-3 text-right">{hasDiscount ? 'Price (after discount)' : 'Unit Price'}</th>
                  <th className="px-4 py-3 text-right">Invoiced</th>
                  <th className="px-4 py-3 text-right">Already Returned</th>
                  <th className="px-4 py-3 text-right">Returnable</th>
                  <th className="px-4 py-3 text-right">Return Qty</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items.map((item) => {
                  const prevReturned = alreadyReturnedMap[item.id] ?? 0;
                  const maxReturnable = item.quantity - prevReturned;
                  const qty = returnQtys[item.id] ?? 0;
                  const effectiveUnitPrice = parseFloat((Number(item.unit_price) * discountRatio).toFixed(2));
                  const lineCredit = effectiveUnitPrice * qty;

                  return (
                    <tr key={item.id} className={maxReturnable === 0 ? 'opacity-40' : ''}>
                      <td dir="auto" className="px-4 py-3 font-medium text-gray-800 text-left">{item.product_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span>{formatCurrencyEGP(effectiveUnitPrice)}</span>
                        {hasDiscount && (
                          <span className="block text-xs text-gray-400 line-through">
                            {formatCurrencyEGP(Number(item.unit_price))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-600">
                        {prevReturned > 0 ? prevReturned : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {maxReturnable}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={maxReturnable}
                          value={qty}
                          disabled={maxReturnable === 0}
                          onChange={(e) =>
                            updateQty(
                              item.id,
                              Math.min(maxReturnable, Math.max(0, Number(e.target.value)))
                            )
                          }
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm disabled:cursor-not-allowed disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-green-700">
                        {lineCredit > 0 ? formatCurrencyEGP(lineCredit) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {state.errors?.items?.map((err) => (
            <p key={err} className="mt-2 text-sm text-red-500">{err}</p>
          ))}
        </div>

        {/* ── Credit summary ── */}
        <div className="flex items-center justify-end gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Total Credit Amount:</span>
          <span className="text-lg font-bold text-green-700 tabular-nums">
            {formatCurrencyEGP(creditAmount)}
          </span>
        </div>

        {/* ── Resolution type ── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">How to settle the credit?</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex flex-1 cursor-pointer items-start gap-3 rounded-md border border-gray-200 bg-white p-4 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
              <input
                type="radio"
                name="resolution_type"
                value="credit"
                defaultChecked
                className="mt-0.5"
                onChange={() => setResolutionType('credit')}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Apply as credit</p>
                <p className="text-xs text-gray-500">
                  Reduce the customer&apos;s remaining installment balance. No cash changes hands.
                </p>
              </div>
            </label>
            <label className={`flex flex-1 items-start gap-3 rounded-md border p-4 ${
              canCashRefund
                ? 'cursor-pointer border-gray-200 bg-white has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50'
                : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-50'
            }`}>
              <input
                type="radio"
                name="resolution_type"
                value="cash_refund"
                disabled={!canCashRefund}
                className="mt-0.5"
                onChange={() => setResolutionType('cash_refund')}
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Cash refund</p>
                {canCashRefund ? (
                  <p className="text-xs text-green-700 font-medium">
                    {formatCurrencyEGP(cashRefundable)} available to refund
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Not available — customer has not overpaid this invoice.
                  </p>
                )}
              </div>
            </label>
          </div>
          {state.errors?.resolution_type?.map((err) => (
            <p key={err} className="mt-2 text-sm text-red-500">{err}</p>
          ))}
        </div>

        {/* ── Account selector (cash refund only) ── */}
        {resolutionType === 'cash_refund' && canCashRefund && (
          <div>
            <label htmlFor="account_id" className="mb-2 block text-sm font-medium text-gray-700">
              Pay from account <span className="text-red-500">*</span>
            </label>
            <select
              id="account_id"
              name="account_id"
              defaultValue=""
              className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-2"
            >
              <option value="" disabled>Select an EGP account…</option>
              {egpAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.method} — balance: {formatCurrencyEGP(Number(acc.balance))}
                </option>
              ))}
            </select>
            {state.errors?.account_id?.map((err) => (
              <p key={err} className="mt-2 text-sm text-red-500">{err}</p>
            ))}
          </div>
        )}

        {/* ── Reason ── */}
        <div>
          <label htmlFor="reason" className="mb-2 block text-sm font-medium text-gray-700">
            Return reason <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            placeholder="e.g. Defective product, wrong item shipped"
            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-2 placeholder:text-gray-400"
          />
        </div>

        {/* ── Notes ── */}
        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-medium text-gray-700">
            Notes <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Any additional details..."
            className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-2 placeholder:text-gray-400"
          />
        </div>

        {/* Global error */}
        {state.message && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{state.message}</p>
        )}
        {state.errors?.general?.map((err) => (
          <p key={err} className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>
        ))}

      </div>

      <div className="mt-6 flex justify-end gap-4">
        <Link
          href={`/dashboard/invoices`}
          className="flex h-10 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={creditAmount === 0}>
          Confirm Return
        </Button>
      </div>
    </form>
  );
}
