import ReturnForm from '../../../../../ui/invoices/return-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getInvoiceById, getInvoiceInstallmentTotals } from '@/app/lib/db/invoices';
import { createReturnAction, getAlreadyReturnedQuantities } from '@/app/lib/db/returns';
import { getWalletAccounts } from '@/app/lib/db/wallet-accounts';
import { notFound } from 'next/navigation';
import InvoicePaymentSummary from '@/app/ui/invoices/invoice-payment-summary';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const [invoice, alreadyReturnedMap, installmentTotals, allAccounts] = await Promise.all([
    getInvoiceById(id),
    getAlreadyReturnedQuantities(id).then((map) => Object.fromEntries(map)),
    getInvoiceInstallmentTotals(id),
    getWalletAccounts(),
  ]);

  if (!invoice) notFound();

  const egpAccounts = allAccounts.filter((a) => a.currency === 'EGP');

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
        egpAccounts={egpAccounts}
        action={action}
      />
    </main>
  );
}
