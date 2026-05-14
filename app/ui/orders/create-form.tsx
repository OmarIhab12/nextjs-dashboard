'use client';

// app/ui/orders/create-form.tsx

import { useActionState, useState } from 'react';
import Link                          from 'next/link';
import { Button }                    from '@/app/ui/button';
import { createOrderAction, type OrderState } from '@/app/lib/actions/orders';

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
import OrderLineItems          from '@/app/ui/orders/line-items';
import type { Supplier }       from '@/app/lib/db/suppliers';
import type { ProductField }   from '@/app/ui/orders/line-items';

export default function CreateOrderForm({
  suppliers,
  products,
}: {
  suppliers: Supplier[];
  products:  ProductField[];
}) {
  const [state, formAction] = useActionState(createOrderAction, initialState);
  const [total, setTotal]   = useState(0);

  return (
    <form action={formAction}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">

        {/* Supplier */}
        <SupplierSelect
          suppliers={suppliers}
          errors={state.errors?.supplier_id}
        />

        {/* Order Status */}
        <OrderStatusField />

        {/* Due date */}
        <DueDateField errors={state.errors?.due_date} />

        {/* Notes */}
        <NotesField />

        {/* Line Items */}
        <OrderLineItems
          products={products}
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
        <Button type="submit">Create Order</Button>
      </div>
    </form>
  );
}