'use client';

import { CustomerField} from '@/app/lib/definitions';
import {
  CurrencyDollarIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { TbDiscount } from "react-icons/tb";
import Link from 'next/link';
import { Button } from '@/app/ui/button';
import { InvoiceStatus } from '@/app/ui/invoices/status';
import {updateInvoiceAction, State, InvoiceWithItems} from '@/app/lib/db/invoices'
import DatePicker from "react-datepicker";
import { useState, useActionState } from "react";
import LineItems from '@/app/ui/invoices/line-items';
import { Product } from '@/app/lib/db/products';

export default function EditInvoiceForm({
  invoice,
  customers,
  products,
}: {
  invoice: InvoiceWithItems;
  customers: CustomerField[];
  products: Product[]
}) {
  const initialState: State = { message: null, errors: {} };
  const updateInvoiceWithId = (state: State, formData: unknown) =>
    updateInvoiceAction(state, invoice.id, formData as FormData);

  const [state, formAction] = useActionState(updateInvoiceWithId, initialState);
  
  const [startDate, setStartDate] = useState(invoice.due_date);

  console.log(invoice.items);

  return (
    <form action={formAction}>
      <div className="rounded-md bg-gray-50 p-4 md:p-6">
        
        {/* Customer Name */}
        <div className="mb-4">
          <label htmlFor="customer" className="mb-2 block text-sm font-medium">
            Choose customer
          </label>
          <div className="relative">
            <select
              id="customer"
              name="customer_id"
              className="peer block w-full cursor-pointer rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
              defaultValue={invoice.customer_id}
            >
              <option value="" disabled>
                Select a customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
          </div>
          <div id="customer-error" aria-live="polite" aria-atomic="true">
            {state.errors?.customer_id &&
              state.errors.customer_id.map((error: string) => (
                <p className="mt-2 text-sm text-red-500" key={error}>
                  {error}
                </p>
              ))}
          </div>
        </div>

        {/* Invoice Amount */}
        {/* <div className="mb-4">
          <label htmlFor="total" className="mb-2 block text-sm font-medium">
            Total invoice price
          </label>
          <div className="relative mt-2 rounded-md">
            <div className="relative">
              <input
                id="total"
                name="total"
                type="number"
                step="0.01"
                defaultValue={invoice.total}
                placeholder="Enter USD amount"
                className="peer block w-full rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
              />
              <CurrencyDollarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
        </div> */}

        {/* Discount Type */}
        <div className="mb-4">
          <label htmlFor="customer" className="mb-2 block text-sm font-medium">
            Choose discount type
          </label>
          <div className="relative">
            <select
              id="discount_type"
              name="discount_type"
              className="peer block w-full cursor-pointer rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
              defaultValue={invoice.discount_type}
            >
              <option value="" disabled>
                Select discount type
              </option>
              <option key="percentage" value="percentage">
                percentage
              </option>

              <option key="amount" value="amount">
                amount
              </option>

            </select>
            <TbDiscount className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
          </div>
          <div id="discount-type-error" aria-live="polite" aria-atomic="true">
            {state.errors?.discount_type &&
              state.errors.discount_type.map((error: string) => (
                <p className="mt-2 text-sm text-red-500" key={error}>
                  {error}
                </p>
              ))}
          </div>
        </div>

        {/* Discount Amount */}
        <div className="mb-4">
          <label htmlFor="total" className="mb-2 block text-sm font-medium">
            Discount amount
          </label>
          <div className="relative mt-2 rounded-md">
            <div className="relative">
              <input
                id="discount_value"
                name="discount_value"
                type="number"
                step="0.01"
                defaultValue={invoice.discount_value}
                placeholder="Enter USD amount"
                className="peer block w-full rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
              />
              <CurrencyDollarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
            </div>
          </div>
          <div id="discount-value-error" aria-live="polite" aria-atomic="true">
            {state.errors?.discount_value &&
              state.errors.discount_value.map((error: string) => (
                <p className="mt-2 text-sm text-red-500" key={error}>
                  {error}
                </p>
              ))}
          </div>
        </div>
        
        {/* Due date */}
        <div className="mb-4">
          <label htmlFor="total" className="mb-2 block text-sm font-medium">
            Due date
          </label>
          <div className="relative mt-2 rounded-md">
            <div className="relative">
              <DatePicker
                id="due_date"
                name="due_date"
                selected={startDate}
                onChange={(date: Date| null) => { if (date) setStartDate(date); }}
                minDate={new Date()}
              />
            </div>
          </div>
          <div id="customer-error" aria-live="polite" aria-atomic="true">
            {state.errors?.due_date &&
              state.errors.due_date.map((error: string) => (
                <p className="mt-2 text-sm text-red-500" key={error}>
                  {error}
                </p>
              ))}
          </div>
        </div>

        
        {/* Invoice Status */}
        <div className="mb-4">
        <fieldset>
          <legend className="mb-2 block text-sm font-medium">
            Set the invoice status
          </legend>
          <div className="rounded-md border border-gray-200 bg-white px-[14px] py-3">
            <div className="flex gap-4">
              <div className="flex items-center">
                <input
                  id="draft"
                  name="status"
                  type="radio"
                  value="draft"
                  defaultChecked={invoice.status === 'draft'}
                  className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
                />
                <div className='ml-1'>
                <InvoiceStatus status={"draft"} />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  id="confirmed"
                  name="status"
                  type="radio"
                  value="confirmed"
                  defaultChecked={invoice.status === 'confirmed'}
                  className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
                />
                <div className='ml-1'>
                <InvoiceStatus status={"confirmed"} />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  id="shipped"
                  name="status"
                  type="radio"
                  value="shipped"
                  defaultChecked={invoice.status === 'shipped'}
                  className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
                />
                <div className='ml-1'>
                <InvoiceStatus status={"shipped"} />
                </div>
              </div>
              <div className="flex items-center">
                <input
                  id="cancelled"
                  name="status"
                  type="radio"
                  value="cancelled"
                  defaultChecked={invoice.status === 'cancelled'}
                  className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
                />
                <div className='ml-1'>
                <InvoiceStatus status={"cancelled"} />
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        </div>

        {/* Notes */}
        <div className="mb-4">
          <label htmlFor="total" className="mb-2 block text-sm font-medium">
            Notes
          </label>
          <div className="relative mt-2 rounded-md">
            <div className="relative">
              <input
                id="notes"
                name="notes"
                defaultValue={invoice.notes?? undefined}
                placeholder="Enter extra notes"
                className="peer block w-full rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
              />
            </div>
          </div>
          </div>

        {/* ── Line Items ── */}
        <LineItems
          products={products}
          initialItems={invoice.items}
          errors={state.errors?.items}
        />

        {/* Global error */}
        <div className="mb-4">
          {state.message && (
            <p className="mt-2 text-sm text-red-500">{state.message}</p>
          )}
        </div>
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
