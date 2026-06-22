import ReturnForm from '@/app/ui/invoices/return-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getInvoiceById } from '@/app/lib/db/invoices';
import { createReturnAction, getAlreadyReturnedQuantities } from '@/app/lib/db/returns';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  const [invoice, alreadyReturnedMap] = await Promise.all([
    getInvoiceById(id),
    getAlreadyReturnedQuantities(id).then((map) => Object.fromEntries(map)),
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
      <ReturnForm
        invoice={invoice}
        alreadyReturnedMap={alreadyReturnedMap}
        action={action}
      />
    </main>
  );
}
