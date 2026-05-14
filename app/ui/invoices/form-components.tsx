'use client';

import { UserCircleIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { TbDiscount } from 'react-icons/tb';
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import { Customer } from '@/app/lib/db/customers';
import { InvoiceStatus } from '@/app/ui/shared/status';
import type { InvoiceStatus as InvoiceStatusType, DiscountType } from '@/app/lib/db/invoices';
import { fmt } from '@/app/lib/utils';

// ── CustomerSelect ────────────────────────────────────────────
export function CustomerSelect({
  customers,
  defaultValue,
  errors,
}: {
  customers: Customer[];
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div className="mb-4">
      <label htmlFor="customer" className="mb-2 block text-sm font-medium">
        Choose customer
      </label>
      <div className="relative">
        <select
          id="customer"
          name="customer_id"
          defaultValue={defaultValue ?? ''}
          className="peer block w-full cursor-pointer rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
          aria-describedby="customer-error"
        >
          <option value="" disabled>Select a customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
      </div>
      <div id="customer-error" aria-live="polite" aria-atomic="true">
        {errors?.map((error) => (
          <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
        ))}
      </div>
    </div>
  );
}

// ── DiscountFields ────────────────────────────────────────────
export function DiscountFields({
  discountType,
  discountValue,
  onTypeChange,
  onValueChange,
  errors,
}: {
  discountType:   DiscountType | '';
  discountValue:  number;
  onTypeChange:   (v: DiscountType | '') => void;
  onValueChange:  (v: number) => void;
  errors?: {
    discount_type?:  string[];
    discount_value?: string[];
  };
}) {
  return (
    <>
      {/* Discount Type */}
      <div className="mb-4">
        <label htmlFor="discount_type" className="mb-2 block text-sm font-medium">
          Discount type
        </label>
        <div className="relative">
          <select
            id="discount_type"
            name="discount_type"
            value={discountType}
            onChange={(e) => onTypeChange(e.target.value as DiscountType | '')}
            className="peer block w-full cursor-pointer rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500" 
          >
            <option value="" disabled>Select discount type</option>
            <option value="percentage">Percentage (%)</option>
            <option value="amount">Fixed amount ($)</option>
          </select>
          <TbDiscount className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
        </div>
        <div aria-live="polite" aria-atomic="true">
          {errors?.discount_type?.map((error) => (
            <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
          ))}
        </div>
      </div>

      {/* Discount Value */}
      <div className="mb-4">
        <label htmlFor="discount_value" className="mb-2 block text-sm font-medium">
          Discount value
        </label>
        <div className="relative">
          <input
            id="discount_value"
            name="discount_value"
            type="number"
            step="0.01"
            min={0}
            value={discountValue}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="peer block w-full rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500" 
          />
          <CurrencyDollarIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
        </div>
        <div aria-live="polite" aria-atomic="true">
          {errors?.discount_value?.map((error) => (
            <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
          ))}
        </div>
      </div>
    </>
  );
}

// ── DueDateField ──────────────────────────────────────────────
export function DueDateField({
  defaultValue,
  errors,
}: {
  defaultValue?: Date | null;
  errors?: string[];
}) {
  const [date, setDate] = useState<Date | null>(defaultValue ?? null);

  return (
    <div className="mb-4">
      <label htmlFor="due_date" className="mb-2 block text-sm font-medium">
        Due date
      </label>
      <DatePicker
        id="due_date"
        name="due_date"
        selected={date}
        onChange={(d: Date | null) => { if (d) setDate(d); }}
        dateFormat="yyyy-MM-dd"
        placeholderText="Select due date"
        minDate={new Date()}
        className="block w-full rounded-md border border-gray-200 py-2 px-3 text-sm outline-2 placeholder:text-gray-500"
      />
      <div aria-live="polite" aria-atomic="true">
        {errors?.map((error) => (
          <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
        ))}
      </div>
    </div>
  );
}

// ── InvoiceStatusField ────────────────────────────────────────
export function InvoiceStatusField({
  defaultValue = 'draft',
}: {
  defaultValue?: InvoiceStatusType;
}) {
  const statuses: InvoiceStatusType[] = ['draft', 'confirmed', 'shipped'];

  return (
    <fieldset className="mb-4">
      <legend className="mb-2 block text-sm font-medium">Invoice status</legend>
      <div className="rounded-md border border-gray-200 bg-white px-[14px] py-3">
        <div className="flex gap-4">
          {statuses.map((s) => (
            <div key={s} className="flex items-center">
              <input
                id={s}
                name="status"
                type="radio"
                value={s}
                defaultChecked={s === defaultValue}
                className="h-4 w-4 cursor-pointer border-gray-300 bg-gray-100 text-gray-600 focus:ring-2"
              />
              <div className="ml-1">
                <InvoiceStatus status={s} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

// ── NotesField ────────────────────────────────────────────────
export function NotesField({
  defaultValue,
}: {
  defaultValue?: string | null;
}) {
  return (
    <div className="mb-4">
      <label htmlFor="notes" className="mb-2 block text-sm font-medium">
        Notes
      </label>
      <textarea
        id="notes"
        name="notes"
        rows={3}
        defaultValue={defaultValue ?? ''}
        placeholder="Payment terms, delivery notes…"
        className="block w-full rounded-md border border-gray-200 py-2 px-3 text-sm outline-2 placeholder:text-gray-500 resize-none"
      />
    </div>
  );
}

export function MoneyField({
  subtotal,
  discountAmount,
  total,
  discountType,
  discountValue,
}: {subtotal: number; discountAmount: number; total: number; discountType?: DiscountType; discountValue?: number;
}) {
  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="tabular-nums">E£{fmt(subtotal)}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>
                Discount
                {discountType === 'percentage' ? ` (${discountValue}%)` : ''}
              </span>
              <span className="tabular-nums">−E£{fmt(discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">E£{fmt(total)}</span>
          </div>
        </div>
  );
}

// ── FormErrorMessage ──────────────────────────────────────────
export function FormErrorMessage({
  message,
}: {
  message?: string | null;
}) {
  if (!message) return null;
  return <p className="mt-2 text-sm text-red-500">{message}</p>;
}