import Form from '@/app/ui/invoices/create-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { getAllCustomers } from '@/app/lib/db/customers';
import { getAllProducts } from '@/app/lib/db/products';
 
export default async function Page() {
  const customers = await getAllCustomers();
  const products = await getAllProducts();
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Invoices', href: '/dashboard/invoices' },
          {
            label: 'Create Invoice',
            href: '/dashboard/invoices/create',
            active: true,
          },
        ]}
      />
      <Form customers={customers} products={products}/>
    </main>
  );
}