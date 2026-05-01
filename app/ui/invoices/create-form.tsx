'use client';
import Link from 'next/link';
import {
  CurrencyDollarIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { TbDiscount } from "react-icons/tb";
import { Button } from '@/app/ui/button';
import { createInvoiceAction, State } from '@/app/lib/db/invoices';
import { useActionState, useState } from 'react';
import { InvoiceStatus } from '@/app/ui/invoices/status';
import DatePicker from "react-datepicker";
import { Customer } from '@/app/lib/db/customers';
import { Product } from '@/app/lib/db/products';
import LineItems from '@/app/ui/invoices/line-items';
import { fmt } from '@/app/lib/utils';
import {
  CustomerSelect, DiscountFields, DueDateField,
  InvoiceStatusField, NotesField, FormErrorMessage, MoneyField
} from '@/app/ui/invoices/form-components';

export default function Form({ customers, products }: { customers: Customer[]; products: Product[];}) {
  const initialState: State = { message: null, errors: {} };
  const [state, formAction] = useActionState(createInvoiceAction, initialState);
  const [startDate, setStartDate] = useState(new Date());
  
  const [subtotal,      setSubtotal]      = useState(0);
  const [discountType,  setDiscountType]  = useState<'percentage' | 'amount' | ''>(
    'percentage'
  );
  const [discountValue, setDiscountValue] = useState<number>(
    0
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
        <CustomerSelect customers={customers} errors={state.errors?.customer_id} />

        {/* Discount */}
        <DiscountFields errors={{ discount_type: state.errors?.discount_type, discount_value: state.errors?.discount_value }} />
        
        {/* Due date */}
        <DueDateField errors={state.errors?.due_date} />
        
                
        {/* Invoice Status */}
        <InvoiceStatusField />

        {/* Notes */}
        <NotesField />

        {/* ── Line Items ── */}
        <LineItems
          products={products}
          errors={state.errors?.items}
          onSubtotalChange={setSubtotal}
        />

        {/* Subtotal */}
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
        <Button type="submit">Create Invoice</Button>
      </div>
    </form>
  );
}
