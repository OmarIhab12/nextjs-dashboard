import type { CustomerInvoiceSummary } from '@/app/lib/db/customers';
import { TableContainer, TableRows, TableEmpty } from '@/app/ui/table-components';
import { PaymentStatus } from '@/app/ui/invoices/status';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CustomerInvoices({
  invoices,
  totalPaid,
}: {
  invoices:  CustomerInvoiceSummary[];
  totalPaid: number;
}) {
  const grandTotal = invoices.reduce((s, i) => s + Number(i.total), 0);
  
  // customer-invoices.tsx — use identical grid string in header and rows
    const COLS = 'grid-cols-[1fr_1fr_6rem]';

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Invoices</h3>
        {invoices.length > 0 && (
          <span className="text-xs text-gray-400">
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Summary bar */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-400">Total invoiced</p>
            <p className="text-sm font-semibold text-gray-800 tabular-nums">${fmt(grandTotal)}</p>
          </div>
          <div className="rounded-md bg-green-50 border border-green-100 px-3 py-2">
            <p className="text-xs text-green-600">Total paid</p>
            <p className="text-sm font-semibold text-green-700 tabular-nums">${fmt(totalPaid)}</p>
          </div>
        </div>
      )}

      {/* Invoices table */}
      <TableContainer>
        <div className={`grid ${COLS} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
            <span>Date</span>
            <span className="text-center">Total</span>
            <span className="text-center">Status</span>
        </div>
        <TableRows>
          {invoices.length === 0 && <TableEmpty message="No invoices yet." />}
          {invoices.map((inv) => (
            <div key={inv.id} className={`grid ${COLS} items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors`}>
                <span className="text-sm text-gray-500">{fmtDate(inv.created_at)}</span>
                <span className="text-center text-sm font-medium tabular-nums text-gray-800">
                    ${fmt(Number(inv.total))}
                </span>
                <div className="flex justify-center">
                    <PaymentStatus status={inv.payment_status} />
                </div>
            </div>
          ))}
        </TableRows>
      </TableContainer>
    </div>
  );
}