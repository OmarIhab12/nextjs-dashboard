import Form from '@/app/ui/invoices/edit-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getInvoiceById, getInvoiceInstallmentTotals } from '@/app/lib/db/invoices';
import { getAllCustomers } from '@/app/lib/db/customers';
import { notFound } from 'next/navigation';
import { getActiveAvailableProducts, getProductsByIds } from '@/app/lib/db/products';
import { DownloadPDFButton } from '@/app/ui/button';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
import ReturnsList from '@/app/ui/invoices/returns-list';
import InvoicePaymentSummary from '@/app/ui/invoices/invoice-payment-summary';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;

  const [invoice, customers, activeProducts, installmentTotals] = await Promise.all([
    getInvoiceById(id),
    getAllCustomers(),
    getActiveAvailableProducts(),
    getInvoiceInstallmentTotals(id),
  ]);

  noStore();

  if (!invoice) notFound();

  // The invoice may reference products that are now inactive or out of stock —
  // those still need to appear as options so existing line items render correctly.
  const existingProductIds = invoice.items
    .map((item) => item.product_id)
    .filter((productId): productId is string => Boolean(productId));
  const activeProductIds = new Set(activeProducts.map((p) => p.id));
  const missingProductIds = existingProductIds.filter((productId) => !activeProductIds.has(productId));
  const missingProducts = await getProductsByIds([...new Set(missingProductIds)]);
  const products = [...activeProducts, ...missingProducts];

  const hasPayments = installmentTotals.totalPaid > 0;

  let customerName = 'unknown';
  for (const customer of customers) {
    if (customer.id === invoice.customer_id) { customerName = customer.name; break; }
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <Breadcrumbs
          breadcrumbs={[
            { label: 'Invoices', href: '/dashboard/invoices' },
            { label: 'Edit Invoice', href: `/dashboard/invoices/${id}/edit`, active: true },
          ]}
        />
        <div className="flex items-center gap-3">
          {hasPayments && (
            <Link href={`/dashboard/invoices/${id}/return`} className="btn-primary">
              Create Return
            </Link>
          )}
          <DownloadPDFButton invoiceId={id} customerName={customerName} />
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <InvoicePaymentSummary
          invoiceTotal={Number(invoice.total)}
          totalDue={installmentTotals.totalDue}
          totalPaid={installmentTotals.totalPaid}
        />

        {hasPayments && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <strong>Editing locked.</strong> This invoice has recorded payments and cannot be modified.
            Use <strong>Create Return</strong> to process a product return or credit.
          </div>
        )}
      </div>

      <Form invoice={invoice} customers={customers} products={products} locked={hasPayments} />

      <ReturnsList
        invoiceId={id}
        invoiceTotal={Number(invoice.total)}
        totalPaid={installmentTotals.totalPaid}
        totalDue={installmentTotals.totalDue}
      />
    </main>
  );
}