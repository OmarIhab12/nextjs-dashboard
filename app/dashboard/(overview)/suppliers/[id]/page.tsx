// app/dashboard/suppliers/[id]/page.tsx

import { notFound }          from 'next/navigation';
import { getSupplierById }   from '@/app/lib/db/suppliers';
import { getAllOrders }       from '@/app/lib/db/orders';
import { getPaymentsByOrder } from '@/app/lib/db/order-payments';
import SupplierDetail        from '@/app/ui/suppliers/supplier-detail';
import SupplierOrders        from '@/app/ui/suppliers/supplier-orders';
import SupplierPayments      from '@/app/ui/suppliers/supplier-payments';
import { lusitana }          from '@/app/ui/fonts';
import type { OrderPayment } from '@/app/lib/db/order-payments';

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  // All orders for this supplier
  const allOrders   = await getAllOrders();
  const orders      = allOrders.filter((o) => o.supplier_id === id);

  // All payments across all orders for this supplier
  const paymentArrays = await Promise.all(orders.map((o) => getPaymentsByOrder(o.id)));
  const allPayments: OrderPayment[] = paymentArrays.flat().sort(
    (a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime(),
  );

  const totalOrdered = orders.reduce((s, o) => s + Number(o.total_usd), 0);
  const totalPaid    = orders.reduce((s, o) => s + Number(o.paid_usd),  0);
  const totalOwed    = totalOrdered - totalPaid;

  return (
    <div className="w-full space-y-6">
      {/* Back link */}
      <a
        href="/dashboard/suppliers"
        className={`${lusitana.className} text-2xl inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors`}
      >
        ← Suppliers
      </a>

      {/* Supplier details */}
      <SupplierDetail supplier={supplier} />

      {/* Orders (left) | Payments (right) — mirrors customer page layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SupplierOrders
          orders={orders}
          totalOrdered={totalOrdered}
          totalPaid={totalPaid}
        />
        <SupplierPayments
          key={allPayments.length}
          supplierId={id}
          payments={allPayments}
          totalOwed={totalOwed}
        />
      </div>
    </div>
  );
}
