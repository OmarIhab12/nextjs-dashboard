'use client';

import { useState, useTransition } from 'react';
import {
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  NoSymbolIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { createProductAction, updateProductAction } from '@/app/lib/actions/products';

// ── Types ─────────────────────────────────────────────────────
export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price: string;
  stock_quantity: number;
  is_active: boolean;
};

type EditState = {
  name: string;
  sku: string;
  description: string;
  price: string;
  stock_quantity: string;
  is_active: boolean;
};

type RowMode = 'view' | 'edit' | 'new';

type ProductRowEntry = ProductRow & { _key: string; mode: RowMode };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function toEditState(p: ProductRow): EditState {
  return {
    name:           p.name,
    sku:            p.sku ?? '',
    description:    p.description ?? '',
    price:          p.price,
    stock_quantity: String(p.stock_quantity),
    is_active:      p.is_active,
  };
}

function emptyEditState(): EditState {
  return { name: '', sku: '', description: '', price: '', stock_quantity: '0', is_active: true };
}

// ── Sub-components ────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      active
        ? 'bg-green-50 text-green-700 ring-1 ring-green-600/20'
        : 'bg-gray-100 text-gray-500 ring-1 ring-gray-400/20'
    }`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}


function EditInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={type === 'number' ? '0.01' : undefined}
      min={type === 'number' ? '0' : undefined}
      className={`block w-full rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 ${className}`}
    />
  );
}

// ── Main Component ────────────────────────────────────────────
export default function ProductsTable({ products }: { products: ProductRow[] }) {
  const [rows, setRows] = useState<ProductRowEntry[]>(
    products.map((p) => ({ ...p, _key: p.id, mode: 'view' }))
  );
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [isPending,  startTransition] = useTransition();

  // ── Helpers ────────────────────────────────────────────────
  const setEdit = (key: string, patch: Partial<EditState>) =>
    setEditStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const setError = (key: string, msg: string) =>
    setErrors((prev) => ({ ...prev, [key]: msg }));

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  const setMode = (key: string, mode: RowMode) =>
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, mode } : r));

  // ── Validate ───────────────────────────────────────────────
  function validate(key: string, state: EditState): boolean {
    if (!state.name.trim()) {
      setError(key, 'Product name is required.');
      return false;
    }
    if (!state.price || parseFloat(state.price) < 0) {
      setError(key, 'Please enter a valid price.');
      return false;
    }
    if (parseInt(state.stock_quantity) < 0) {
      setError(key, 'Stock quantity cannot be negative.');
      return false;
    }
    clearError(key);
    return true;
  }

  // ── Start editing ──────────────────────────────────────────
  const startEdit = (row: ProductRowEntry) => {
    setEditStates((prev) => ({ ...prev, [row._key]: toEditState(row) }));
    setMode(row._key, 'edit');
  };

  // ── Cancel editing ─────────────────────────────────────────
  const cancelEdit = (row: ProductRowEntry) => {
    if (row.mode === 'new') {
      // Remove the new row entirely
      setRows((prev) => prev.filter((r) => r._key !== row._key));
    } else {
      clearError(row._key);
      setMode(row._key, 'view');
    }
    setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
  };

  // ── Save existing product ──────────────────────────────────
  const saveEdit = (row: ProductRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;

    startTransition(async () => {
      try {
        const updated = await updateProductAction(row.id, {
          name:           state.name,
          sku:            state.sku || undefined,
          description:    state.description || undefined,
          price:          parseFloat(state.price),
          stock_quantity: parseInt(state.stock_quantity),
          is_active:      state.is_active,
        });

        if (!updated) {
          setError(row._key, 'Failed to update product.');
          return;
        }

        setRows((prev) =>
          prev.map((r) =>
            r._key === row._key
              ? { ...r, ...updated, price: updated.price, mode: 'view' }
              : r
          )
        );
        clearError(row._key);
        setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
      } catch {
        setError(row._key, 'An error occurred. Please try again.');
      }
    });
  };

  // ── Save new product ───────────────────────────────────────
  const saveNew = (row: ProductRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;

    startTransition(async () => {
      try {
        const created = await createProductAction({
          name:           state.name,
          sku:            state.sku || undefined,
          description:    state.description || undefined,
          price:          parseFloat(state.price),
          stock_quantity: parseInt(state.stock_quantity),
          is_active:      state.is_active,
        });

        setRows((prev) =>
          prev.map((r) =>
            r._key === row._key
              ? { ...r, ...created, id: created.id, _key: created.id, price: created.price, mode: 'view' }
              : r
          )
        );
        clearError(row._key);
        setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
      } catch {
        setError(row._key, 'An error occurred. Please try again.');
      }
    });
  };

  // ── Toggle active/inactive ─────────────────────────────────
  const handleToggleActive = (row: ProductRowEntry) => {
    const action = row.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${row.name}"?`)) return;

    startTransition(async () => {
      try {
        const updated = await updateProductAction(row.id, { is_active: !row.is_active });
        if (!updated) { setError(row._key, `Failed to ${action} product.`); return; }
        setRows((prev) => prev.map((r) => r._key === row._key ? { ...r, is_active: updated.is_active } : r));
      } catch {
        setError(row._key, 'An error occurred. Please try again.');
      }
    });
  };

  // ── Add new row ────────────────────────────────────────────
  const addNewRow = () => {
    // Only allow one new row at a time
    if (rows.some((r) => r.mode === 'new')) return;
    const key = uid();
    const newRow: ProductRowEntry = {
      _key: key, id: '', mode: 'new',
      name: '', sku: null, description: null,
      price: '0', stock_quantity: 0, is_active: true,
    };
    setRows((prev) => [newRow, ...prev]); // prepend so it appears at top
    setEditStates((prev) => ({ ...prev, [key]: emptyEditState() }));
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="mt-6 flow-root">
      {/* Shared grid wrapper */}
      <div className="rounded-md border border-gray-200 bg-white overflow-hidden">

        {/* Column headers — + icon in last column to add new row */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          <span>Name / Description</span>
          <span>SKU</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Status</span>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addNewRow}
              disabled={isPending || rows.some((r) => r.mode === 'new')}
              title="Add new product"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isEditing = row.mode === 'edit' || row.mode === 'new';
            const state     = editStates[row._key];
            const error     = errors[row._key];

            return (
              <div key={row._key}>
                <div className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_5rem] items-center gap-2 px-3 py-2 transition-colors ${
                  isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'
                }`}>

                  {/* Name / Description */}
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <EditInput value={state.name} onChange={(v) => setEdit(row._key, { name: v })} placeholder="Product name" />
                      <EditInput value={state.description} onChange={(v) => setEdit(row._key, { description: v })} placeholder="Description (optional)" />
                    </div>
                  ) : (
                    <div className={`flex flex-col py-1 ${!row.is_active ? 'opacity-50' : ''}`}>
                      <span className="text-sm font-medium text-gray-800">{row.name}</span>
                      {row.description && <span className="text-xs text-gray-400 line-clamp-1">{row.description}</span>}
                    </div>
                  )}

                  {/* SKU */}
                  {isEditing ? (
                    <EditInput value={state.sku} onChange={(v) => setEdit(row._key, { sku: v })} placeholder="SKU-001" />
                  ) : (
                    <span className={`text-sm font-mono text-gray-500 ${!row.is_active ? 'opacity-50' : ''}`}>
                      {row.sku ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* Price */}
                  {isEditing ? (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                      <EditInput value={state.price} onChange={(v) => setEdit(row._key, { price: v })} type="number" placeholder="0.00" className="pl-5" />
                    </div>
                  ) : (
                    <span className={`text-sm tabular-nums text-gray-700 ${!row.is_active ? 'opacity-50' : ''}`}>
                      ${parseFloat(row.price).toFixed(2)}
                    </span>
                  )}

                  {/* Stock */}
                  {isEditing ? (
                    <EditInput value={state.stock_quantity} onChange={(v) => setEdit(row._key, { stock_quantity: v })} type="number" placeholder="0" />
                  ) : (
                    <span className={`text-sm tabular-nums ${
                      row.stock_quantity === 0 ? 'text-red-500' :
                      row.stock_quantity < 5  ? 'text-amber-500' : 'text-gray-700'
                    } ${!row.is_active ? 'opacity-50' : ''}`}>
                      {row.stock_quantity}
                    </span>
                  )}

                  {/* Status */}
                  {isEditing ? (
                    <button type="button" onClick={() => setEdit(row._key, { is_active: !state.is_active })} className="flex justify-start">
                      <StatusBadge active={state.is_active} />
                    </button>
                  ) : (
                    <div className="flex justify-start">
                      <StatusBadge active={row.is_active} />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={() => row.mode === 'new' ? saveNew(row) : saveEdit(row)}
                          disabled={isPending} title="Save changes"
                          className="rounded-md p-1.5 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors">
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => cancelEdit(row)}
                          disabled={isPending} title="Cancel"
                          className="rounded-md p-1.5 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(row)} title="Edit product"
                          className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleToggleActive(row)} disabled={isPending}
                          title={row.is_active ? 'Deactivate product' : 'Reactivate product'}
                          className={`rounded-md p-1.5 transition-colors disabled:opacity-50 ${
                            row.is_active
                              ? 'text-gray-400 bg-gray-50 hover:bg-red-50 hover:text-red-500'
                              : 'text-gray-400 bg-gray-50 hover:bg-green-50 hover:text-green-600'
                          }`}>
                          {row.is_active
                            ? <NoSymbolIcon className="h-4 w-4" />
                            : <ArrowPathIcon className="h-4 w-4" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Per-row error */}
                {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              No products found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}