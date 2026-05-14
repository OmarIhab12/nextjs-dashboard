// app/dashboard/orders/[id]/edit/page.tsx

import { notFound }        from 'next/navigation';
import Breadcrumbs         from '@/app/ui/invoices/breadcrumbs';
import EditOrderForm        from '@/app/ui/orders/edit-form';
import { getOrderWithItems } from '@/app/lib/db/orders';
import { getAllSuppliers }  from '@/app/lib/db/suppliers';
import { getAllProducts }   from '@/app/lib/db/products';

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [order, suppliers, products] = await Promise.all([
    getOrderWithItems(id),
    getAllSuppliers(),
    getAllProducts(),
  ]);

  console.log('Order:', order);
  if (!order) notFound();

  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Orders', href: '/dashboard/orders' },
          { label: 'Edit Order', href: `/dashboard/orders/${id}/edit`, active: true },
        ]}
      />
      <EditOrderForm order={order} suppliers={suppliers} products={products} />
    </main>
  );
}