// app/dashboard/orders/create/page.tsx

import Breadcrumbs      from '@/app/ui/invoices/breadcrumbs';
import CreateOrderForm  from '@/app/ui/orders/create-form';
import { getAllSuppliers } from '@/app/lib/db/suppliers';
import { getAllProducts }  from '@/app/lib/db/products';

export default async function Page() {
  const [suppliers, products] = await Promise.all([
    getAllSuppliers(),
    getAllProducts(),
  ]);

  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Orders', href: '/dashboard/orders' },
          { label: 'Create Order', href: '/dashboard/orders/create', active: true },
        ]}
      />
      <CreateOrderForm suppliers={suppliers} products={products} />
    </main>
  );
}