'use client';

import {
  CurrencyDollarIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { TbDiscount } from "react-icons/tb";
import Link from 'next/link';
import { Button } from '@/app/ui/button';
import { InvoiceStatus } from '@/app/ui/invoices/status';
import {updateInvoiceAction, State, InvoiceWithItems, DiscountType} from '@/app/lib/db/invoices'
import DatePicker from "react-datepicker";
import { useState, useActionState } from "react";
import LineItems from '@/app/ui/invoices/line-items';
import { Product } from '@/app/lib/db/products';
import { fmt } from '@/app/lib/utils';
import {
  CustomerSelect, DiscountFields, DueDateField,
  InvoiceStatusField, NotesField, FormErrorMessage, MoneyField
} from '@/app/ui/invoices/form-components';
import { Customer } from '@/app/lib/db/customers';

export default function EditInvoiceForm({
  invoice,
  customers,
  products,
}: {
  invoice: InvoiceWithItems;
  customers: Customer[];
  products: Product[]
}) {
  const initialState: State = { message: null, errors: {} };
  const updateInvoiceWithId = (state: State, formData: unknown) =>
    updateInvoiceAction(state, invoice.id, formData as FormData);

  const [state, formAction] = useActionState(updateInvoiceWithId, initialState);
  
  const [startDate, setStartDate] = useState(invoice.due_date);

  const [subtotal,      setSubtotal]      = useState(0);
  const [discountType,  setDiscountType]  = useState<DiscountType | ''>(
    invoice?.discount_type ?? ''
  );
  const [discountValue, setDiscountValue] = useState<number>(
    invoice?.discount_value ?? 0
  );

  // Derived
  const discountAmount = (() => {
    if (discountType === 'percentage') return (subtotal * discountValue) / 100;
    if (discountType === 'amount')     return Math.min(discountValue, subtotal);
    return 0;
  })();
  const total = subtotal - discountAmount;

  return (
    <form action={formAction}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">
        
        {/* Customer Name */}
        <CustomerSelect customers={customers} defaultValue={invoice.customer_id} errors={state.errors?.customer_id} />

        {/* Discount */}
        <DiscountFields
          discountType={discountType}
          discountValue={discountValue}
          onTypeChange={setDiscountType}
          onValueChange={setDiscountValue}
          errors={{
            discount_type:  state.errors?.discount_type,
            discount_value: state.errors?.discount_value,
          }}
        />

        {/* Due date */}
        <DueDateField defaultValue={invoice.due_date} errors={state.errors?.due_date} />

        
        {/* Invoice Status */}
        <InvoiceStatusField defaultValue={invoice.status} />

        {/* Notes */}
        <NotesField defaultValue={invoice.notes} />

        {/* ── Line Items ── */}
        <LineItems
          products={products}
          initialItems={invoice.items}
          errors={state.errors?.items}
          onSubtotalChange={setSubtotal}
        />

        {/* ── Totals ── */}
        <MoneyField
          subtotal={subtotal}
          discountAmount={discountAmount}
          total={total}
          discountType={discountType || undefined}
          discountValue={discountValue || undefined}
        />

        {/* Global error */}
        <FormErrorMessage message={state.message} />
      
      </div>
      <div className="mt-6 flex justify-end gap-4">
        <Link
          href="/dashboard/invoices"
          className="flex h-10 items-center rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          Cancel
        </Link>
        <Button type="submit">Edit Invoice</Button>
      </div>
    </form>
  );
}
