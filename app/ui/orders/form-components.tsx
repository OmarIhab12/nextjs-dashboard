'use client';

// app/ui/orders/form-components.tsx
// Order-specific form fields.
// Reuses DueDateField, NotesField, FormErrorMessage from invoices/form-components.tsx directly.

import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import type { Supplier } from '@/app/lib/db/suppliers';
import type { OrderStatus } from '@/app/lib/db/orders';
import { OrderStatusUI } from '@/app/ui/shared/status';

// ── SupplierSelect ────────────────────────────────────────────
export function SupplierSelect({
  suppliers,
  defaultValue,
  errors,
}: {
  suppliers:    Supplier[];
  defaultValue?: string;
  errors?:      string[];
}) {
  return (
    <div className="mb-4">
      <label htmlFor="supplier_id" className="mb-2 block text-sm font-medium">
        Choose supplier
      </label>
      <div className="relative">
        <select
          id="supplier_id"
          name="supplier_id"
          defaultValue={defaultValue ?? ''}
          className="peer block w-full cursor-pointer rounded-md border border-gray-200 py-2 pl-10 text-sm outline-2 placeholder:text-gray-500"
          aria-describedby="supplier-error"
        >
          <option value="">Select a supplier (optional)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <BuildingStorefrontIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500" />
      </div>
      <div id="supplier-error" aria-live="polite" aria-atomic="true">
        {errors?.map((e) => (
          <p className="mt-2 text-sm text-red-500" key={e}>{e}</p>
        ))}
      </div>
    </div>
  );
}

// ── OrderStatusField ──────────────────────────────────────────
const STATUS_LABELS: Record<OrderStatus, string> = {
  draft:   'Draft',
  confirmed: 'Confirmed',
  shipped:   'Shipped',
  arrived:   'Arrived',
  stored:    'Stored',
  cancelled: 'Cancelled',
};


export function OrderStatusField({
  defaultValue = 'draft',
}: {
  defaultValue?: OrderStatus;
}) {
  const statuses: OrderStatus[] = [ 'draft', 'confirmed', 'shipped', 'arrived', 'stored', 'cancelled' ];
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
                  <OrderStatusUI status={s} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </fieldset>
    );
}

// ── OrderTotals ───────────────────────────────────────────────
export function OrderTotals({ total }: { total: number }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-semibold text-gray-900">
        <span>Total (USD)</span>
        <span className="tabular-nums">${fmt(total)}</span>
      </div>
    </div>
  );
}