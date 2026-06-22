import { getReturnsByInvoice } from '@/app/lib/db/returns';
import { formatCurrencyEGP, formatDateToLocal } from '@/app/lib/utils';

export default async function ReturnsList({
  invoiceId,
  invoiceTotal,
  totalPaid,
  totalDue,
}: {
  invoiceId:    string;
  invoiceTotal: number;
  totalPaid:    number;
  totalDue:     number;
}) {
  const returns = await getReturnsByInvoice(invoiceId);

  if (returns.length === 0) return null;

  const totalCredits = returns.reduce((sum, r) => sum + Number(r.credit_amount), 0);
  const remaining    = Number((totalDue - totalPaid).toFixed(2));

  return (
    <div className="mt-6 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700">Returns</h2>

      {returns.map((r, idx) => (
        <div
          key={r.id}
          className="rounded-md border border-gray-200 bg-white overflow-hidden"
        >
          {/* Return header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Return #{returns.length - idx}
              </span>
              <span className="text-xs text-gray-500">{formatDateToLocal(r.created_at.toString())}</span>
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
            <span className="text-sm font-bold text-red-600 tabular-nums">
              -{formatCurrencyEGP(Number(r.credit_amount))}
            </span>
          </div>

          {/* Returned items */}
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-gray-400">
                <th className="px-4 py-2 text-left font-medium">Product</th>
                <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Line Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {r.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-gray-700">{item.product_name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                    {formatCurrencyEGP(Number(item.unit_price))}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600">
                    -{formatCurrencyEGP(Number(item.line_total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Reason / notes */}
          {(r.reason || r.notes) && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500 space-y-0.5">
              {r.reason && <p><span className="font-medium text-gray-600">Reason:</span> {r.reason}</p>}
              {r.notes  && <p><span className="font-medium text-gray-600">Notes:</span> {r.notes}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Net total summary */}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm space-y-1.5">
        <div className="flex justify-between text-gray-500">
          <span>Original invoice total</span>
          <span className="tabular-nums">{formatCurrencyEGP(invoiceTotal)}</span>
        </div>
        <div className="flex justify-between text-red-600">
          <span>Total credits from returns</span>
          <span className="tabular-nums">-{formatCurrencyEGP(totalCredits)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1.5 text-gray-700">
          <span>Net obligation</span>
          <span className="tabular-nums font-medium">{formatCurrencyEGP(totalDue)}</span>
        </div>
        <div className="flex justify-between text-green-700">
          <span>Amount paid</span>
          <span className="tabular-nums font-medium">{formatCurrencyEGP(totalPaid)}</span>
        </div>
        <div className={`flex justify-between border-t border-gray-200 pt-1.5 font-semibold ${remaining > 0 ? 'text-amber-700' : 'text-green-700'}`}>
          <span>{remaining > 0 ? 'Still owed' : 'Fully settled'}</span>
          <span className="tabular-nums">{formatCurrencyEGP(remaining)}</span>
        </div>
      </div>
    </div>
  );
}
