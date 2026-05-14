'use client';

// app/ui/orders/edit-form.tsx

import { useActionState, useState } from 'react';
import Link                          from 'next/link';
import { Button }                    from '@/app/ui/button';
import { updateOrderAction, type OrderState } from '@/app/lib/actions/orders';

const initialState: OrderState = { errors: {}, message: null };
import {
  SupplierSelect,
  OrderStatusField,
  OrderTotals,
} from '@/app/ui/orders/form-components';
import {
  DueDateField,
  NotesField,
  FormErrorMessage,
} from '@/app/ui/invoices/form-components';
import OrderLineItems             from '@/app/ui/orders/line-items';
import type { Supplier }          from '@/app/lib/db/suppliers';
import type { ProductField, ExistingOrderItem } from '@/app/ui/orders/line-items';
import type { OrderWithItems, OrderStatus }      from '@/app/lib/db/orders';

export default function EditOrderForm({
  order,
  suppliers,
  products,
}: {
  order:     OrderWithItems;
  suppliers: Supplier[];
  products:  ProductField[];
}) {
  const updateWithId = (prevState: OrderState, formData: FormData) =>
    updateOrderAction(prevState, order.id, formData);

  const [state, formAction] = useActionState(updateWithId, initialState);

  const initialTotal = order.items.reduce(
    (s, i) => s + Number(i.unit_price) * i.quantity, 0
  );
  const [total, setTotal] = useState(initialTotal);

  const existingItems: ExistingOrderItem[] = order.items.map((i) => ({
    id:           i.id,
    product_id:   i.product_id,
    product_name: i.product_name,
    unit_price:   i.unit_price,
    quantity:     i.quantity,
  }));

  return (
    <form action={formAction}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">

        {/* Supplier */}
        <SupplierSelect
          suppliers={suppliers}
          defaultValue={order.supplier_id ?? undefined}
          errors={state.errors?.supplier_id}
        />

        {/* Order Status */}
        <OrderStatusField defaultValue={order.status as OrderStatus} />

        {/* Due date */}
        <DueDateField errors={state.errors?.due_date} />

        {/* Notes */}
        <NotesField defaultValue={order.notes} />

        {/* Line Items */}
        <OrderLineItems
          products={products}
          initialItems={existingItems}
          errors={state.errors?.items}
          onTotalChange={setTotal}
        />

        {/* Total */}
        <OrderTotals total={total} />

        {/* Global error */}
        <FormErrorMessage message={state.message} />

      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Link href="/dashboard/orders" className="btn-secondary">
          Cancel
        </Link>
        <Button type="submit">Save Order</Button>
      </div>
    </form>
  );
}