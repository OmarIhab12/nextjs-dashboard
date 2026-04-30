import Form from '@/app/ui/invoices/edit-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getInvoiceById } from '@/app/lib/db/invoices';
import { getAllCustomers } from '@/app/lib/db/customers';
import { notFound } from 'next/navigation';
import { getAllProducts } from '@/app/lib/db/products';
 
export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id;

  const [invoice, customers, products] = await Promise.all([
    getInvoiceById(id),
    getAllCustomers(),
    getAllProducts(),
  ]);

   if (!invoice) {
    notFound();
  }

  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Edit Invoice',
            href: `/dashboard/invoices/${id}/edit`,
            active: true,
          },
        ]}
      />
      <Form invoice={invoice} customers={customers} products={products}/>
    </main>
  );
}