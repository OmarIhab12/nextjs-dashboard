import ReturnForm from '@/app/ui/invoices/return-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getInvoiceById, getInvoiceInstallmentTotals } from '@/app/lib/db/invoices';
import { createReturnAction, getAlreadyReturnedQuantities } from '@/app/lib/db/returns';
import { notFound } from 'next/navigation';
import InvoicePaymentSummary from '@/app/ui/invoices/invoice-payment-summary';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const [invoice, alreadyReturnedMap, installmentTotals] = await Promise.all([
    getInvoiceById(id),
    getAlreadyReturnedQuantities(id).then((map) => Object.fromEntries(map)),
    getInvoiceInstallmentTotals(id),
  ]);

  if (!invoice) notFound();

  const action = createReturnAction.bind(null, id);

  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          { label: 'Edit Invoice', href: `/dashboard/invoices/${id}/edit` },
          { label: 'Create Return', href: `/dashboard/invoices/${id}/return`, active: true },
        ]}
      />
      <div className="mb-6">
        <InvoicePaymentSummary
          invoiceTotal={Number(invoice.total)}
          totalDue={installmentTotals.totalDue}
          totalPaid={installmentTotals.totalPaid}
        />
      </div>
      <ReturnForm
        invoice={invoice}
        alreadyReturnedMap={alreadyReturnedMap}
        invoiceTotalDue={installmentTotals.totalDue}
        invoiceTotalPaid={installmentTotals.totalPaid}
        action={action}
      />
    </main>
  );
}
