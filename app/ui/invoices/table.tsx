import { UpdateInvoice, DeleteInvoice } from '@/app/ui/invoices/buttons';
import { InvoiceStatus, PaymentStatus } from '@/app/ui/shared/status';
import { formatDateToLocal, formatCurrencyEGP } from '@/app/lib/utils';
import { fetchFilteredInvoices } from '@/app/lib/db/invoices';
import {
  TableContainer, TableHeader, TableRows, TableRow,
  TableActions, TableEmpty, MobileCard, MobileCardHeader, MobileCardFooter,
} from '@/app/ui/table-components';
import { DownloadPDFButton } from '../button';

const COLS = 'grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_5rem]';

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
            <MobileCard key={invoice.id}>
              <MobileCardHeader>
                <div>
                  <p className="text-sm font-medium text-gray-800">{invoice.name}</p>
                  <p className="text-xs text-gray-400">{invoice.email}</p>
                </div>
                <InvoiceStatus status={invoice.status} />
              </MobileCardHeader>
              <MobileCardFooter>
                <div>
                  <p className="text-sm font-semibold text-gray-800 tabular-nums">
                    {formatCurrencyEGP(parseInt(invoice.total))}
                  </p>
                  <p className="text-xs text-gray-400">{formatDateToLocal(invoice.created_at)}</p>
                  <div className="mt-1">
                    <PaymentStatus status={invoice.payment_status} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <DownloadPDFButton invoiceId={invoice.id} iconOnly />
                  <UpdateInvoice id={invoice.id} />
                  <DeleteInvoice id={invoice.id} />
                </div>
              </MobileCardFooter>
            </MobileCard>
          ))}
        </div>

        {/* ── Desktop ── */}
        <div className="hidden md:block">
          <TableContainer>
            <TableHeader
              gridCols={COLS}
              columns={['Customer', 'Email', 'Total', 'Date', 'Status', 'Payment']}
            />
            <TableRows>
              {invoices?.length === 0 && <TableEmpty message="No invoices found." />}
              {invoices?.map((invoice) => (
                <TableRow key={invoice.id} gridCols={COLS}>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {invoice.name}
                  </span>
                  <span className="text-sm text-gray-500 truncate">
                    {invoice.email}
                  </span>
                  <span className="text-sm tabular-nums text-gray-700">
                    {formatCurrencyEGP(parseInt(invoice.total))}
                  </span>
                  <span className="text-sm text-gray-500">
                    {formatDateToLocal(invoice.created_at)}
                  </span>
                  <div><InvoiceStatus status={invoice.status} /></div>
                  <div><PaymentStatus status={invoice.payment_status} /></div>
                  <TableActions>
                    <DownloadPDFButton invoiceId={invoice.id} iconOnly />
                    <UpdateInvoice id={invoice.id} />
                    <DeleteInvoice id={invoice.id} />
                  </TableActions>
                </TableRow>
              ))}
            </TableRows>
          </TableContainer>
        </div>

      </div>
    </div>
  );
}