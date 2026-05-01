import { UpdateInvoice, DeleteInvoice } from '@/app/ui/invoices/buttons';
import { InvoiceStatus, PaymentStatus } from '@/app/ui/invoices/status';
import { formatDateToLocal, formatCurrency } from '@/app/lib/utils';
import { fetchFilteredInvoices } from '@/app/lib/db/invoices';

export default async function InvoicesTable({
  query,
  currentPage,
}: {
  query: string;
  currentPage: number;
}) {
  const invoices = await fetchFilteredInvoices(query, currentPage);

  return (
    <div className="mt-6 flow-root">
      <div className="inline-block min-w-full align-middle">

        {/* ── Mobile ── */}
        <div className="md:hidden space-y-2">
          {invoices?.map((invoice) => (
            <div key={invoice.id} className="rounded-md border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{invoice.name}</p>
                  <p className="text-xs text-gray-400">{invoice.email}</p>
                </div>
                <InvoiceStatus status={invoice.status} />
              </div>
              <div className="flex items-center justify-between pt-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 tabular-nums">
                    {formatCurrency(parseInt(invoice.total))}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateToLocal(invoice.created_at)}</p>
                  <div className="mt-1">
                    <PaymentStatus status={invoice.payment_status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <UpdateInvoice id={invoice.id} />
                  <DeleteInvoice id={invoice.id} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Desktop ── */}
        <div className="hidden md:block rounded-md border border-gray-200 bg-white overflow-hidden">

          {/* Column headers */}
          <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            <span>Customer</span>
            <span>Email</span>
            <span>Total</span>
            <span>Date</span>
            <span>Status</span>
            <span>Payment</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100">
            {invoices?.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_5rem] items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-800 truncate">
                  {invoice.name}
                </span>

                <span className="text-sm text-gray-500 truncate">
                  {invoice.email}
                </span>

                <span className="text-sm tabular-nums text-gray-700">
                  {formatCurrency(parseInt(invoice.total))}
                </span>

                <span className="text-sm text-gray-500">
                  {formatDateToLocal(invoice.created_at)}
                </span>

                <div>
                  <InvoiceStatus status={invoice.status} />
                </div>

                <div>
                  <PaymentStatus status={invoice.payment_status} />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <UpdateInvoice id={invoice.id} />
                  <DeleteInvoice id={invoice.id} />
                </div>
              </div>
            ))}

            {invoices?.length === 0 && (
              <div className="py-10 text-center text-sm text-gray-400">
                No invoices found.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}