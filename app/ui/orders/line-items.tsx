'use client';

// app/ui/orders/line-items.tsx
// Mirrors invoice line-items.tsx but:
//  - No stock deduction validation (we're buying, not selling)
//  - Unit price = price we pay the supplier (not retail price)
//  - No UNIQUE constraint — same product can appear in different orders

import { useCallback, useEffect, useState } from 'react';
import { PlusIcon, TrashIcon }               from '@heroicons/react/24/outline';
import { fmt }                               from '@/app/lib/utils';

// ── Types ─────────────────────────────────────────────────────
export type ProductField = {
  id:             string;
  name:           string;
  sku:            string | null;
  price:          string;   // retail price — used as default suggestion only
  stock_quantity: number;
  is_active:      boolean;
};

export interface OrderLineItem {
  _key:          string;
  product_id:    string;
  product_name:  string;
  unit_price:    number;   // price paid to supplier
  quantity:      number;
  original_quantity: number;
}

export interface ExistingOrderItem {
  id:           string;
  product_id:   string | null;
  product_name: string;
  unit_price:   string;
  quantity:     number;
}

// ── Helpers ───────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function emptyItem(): OrderLineItem {
  return { _key: uid(), product_id: '', product_name: '', unit_price: 0, quantity: 1, original_quantity: 0 };
}

// ── Component ─────────────────────────────────────────────────
export default function OrderLineItems({
  products,
  errors,
  initialItems,
  onTotalChange,
}: {
  products:       ProductField[];
  errors?:        string[];
  initialItems?:  ExistingOrderItem[];
  onTotalChange?: (total: number) => void;
}) {
  const [items, setItems] = useState<OrderLineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        _key:              uid(),
        product_id:        item.product_id ?? '',
        product_name:      item.product_name,
        unit_price:        parseFloat(item.unit_price),
        quantity:          item.quantity,
        original_quantity: item.quantity,
      }));
    }
    return [emptyItem()];
  });

  const addItem    = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i._key !== key));

  const updateItem = useCallback(
    (key: string, patch: Partial<OrderLineItem>) =>
      setItems((prev) => prev.map((i) => (i._key === key ? { ...i, ...patch } : i))),
    []
  );

  const selectProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(key, {
        product_id:   product.id,
        product_name: product.name,
        // Suggest retail price as a starting point — user can edit to actual supplier price
        unit_price:   parseFloat(product.price),
      });
    } else {
      updateItem(key, { product_id: '', product_name: '', unit_price: 0 });
    }
  };

  const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  return (
    <div className="mb-4">
      {/* Hidden input — serialises items for the server action */}
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items
            .filter((i) => i.product_id)
            .map(({ _key, ...rest }) => rest)
        )}
      />

      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-sm font-medium">Products</label>
        <button type="button" onClick={addItem} className="btn-Thirdary">
          <PlusIcon className="h-3.5 w-3.5" />
          Add product
        </button>
      </div>

      {/* Column headers */}
      <div className="mb-1 hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-2 text-xs font-medium text-gray-500 md:grid">
        <span>Product</span>
        <span>Qty</span>
        <span>Unit price (USD)</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item._key}
            className="line-item-row grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-2 rounded-md border border-gray-200 bg-white p-2"
          >
            {/* Product */}
            <select
              value={item.product_id}
              onChange={(e) => selectProduct(item._key, e.target.value)}
              className="block w-full cursor-pointer rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-2"
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sku ? ` (${p.sku})` : ''}{!p.is_active ? ' — Inactive' : ''}
                </option>
              ))}
            </select>

            {/* Qty — no max constraint (we're buying) */}
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                updateItem(item._key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
              }
              className="block w-full rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-2 text-center"
            />

            {/* Unit price paid to supplier */}
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                $
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={item.unit_price || ''}
                onChange={(e) =>
                  updateItem(item._key, { unit_price: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="block w-full rounded-md border border-gray-200 py-1.5 pl-5 pr-2 text-sm outline-2"
              />
            </div>

            {/* Line total */}
            <span className="text-right text-sm font-semibold text-gray-700 tabular-nums">
              ${fmt(item.unit_price * item.quantity)}
            </span>

            {/* Remove */}
            <button
              type="button"
              onClick={() => removeItem(item._key)}
              disabled={items.length === 1}
              className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
              title="Remove item"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Errors */}
      {errors?.map((error) => (
        <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
      ))}
    </div>
  );
}