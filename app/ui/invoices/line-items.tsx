'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { fmt } from '@/app/lib/utils';

// ── Types ─────────────────────────────────────────────────────
export type ProductField = {
  id: string;
  name: string;
  sku: string | null;
  price: string;
  stock_quantity: number;
};

export interface LineItem {
  _key: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

// Shape of existing invoice items passed in for editing
export interface ExistingLineItem {
  id: string;
  product_id: string | null;
  product_name: string;
  unit_price: string; // NUMERIC comes back as string from postgres.js
  quantity: number;
}

// ── Helpers ───────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyItem(): LineItem {
  return { _key: uid(), product_id: '', product_name: '', unit_price: 0, quantity: 1 };
}



// ── Component ─────────────────────────────────────────────────
export default function LineItems({
  products,
  errors,
  initialItems,
  onSubtotalChange,
}: {
  products: ProductField[];
  errors?: string[];
  initialItems?: ExistingLineItem[];
  onSubtotalChange?: (subtotal: number) => void;
}) {
  const [items, setItems] = useState<LineItem[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        _key:         uid(),
        product_id:   item.product_id ?? '',
        product_name: item.product_name,
        unit_price:   parseFloat(item.unit_price),
        quantity:     item.quantity,
      }));
    }
    return [emptyItem()];
  });

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (key: string) =>
    setItems((prev) => prev.filter((i) => i._key !== key));

  const updateItem = useCallback(
    (key: string, patch: Partial<LineItem>) =>
      setItems((prev) =>
        prev.map((i) => (i._key === key ? { ...i, ...patch } : i))
      ),
    []
  );

  const selectProduct = (key: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      updateItem(key, {
        product_id: product.id,
        product_name: product.name,
        unit_price: parseFloat(product.price),
      });
    } else {
      updateItem(key, { product_id: '', product_name: '', unit_price: 0 });
    }
  };

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  useEffect(() => {
    onSubtotalChange?.(subtotal);
  }, [subtotal, onSubtotalChange]);


  return (
    <div className="mb-4">
      {/* Hidden input — serializes items for the server action */}
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
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1 rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Add product
        </button>
      </div>

      {/* Column headers */}
      <div className="mb-1 hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-2 text-xs font-medium text-gray-500 md:grid">
        <span>Product</span>
        <div className="flex flex-col gap-0.5">
          <span>Qty</span>
          <span className="font-normal text-gray-300">stock</span>
        </div>
        <span>Unit price</span>
        <span className="text-right">Total</span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {items.map((item) => {
          const selectedProduct = products?.find(p => p.id === item.product_id);
          let maxQty = selectedProduct?.stock_quantity ?? 9999;
          initialItems?.map((existingItem) => {
            if (existingItem.product_id === item.product_id) {
              maxQty += existingItem.quantity;
            }
          })
          return (
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
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={items.some((i) => i._key !== item._key && i.product_id === p.id)}
                  >
                    {p.name}{p.sku ? ` (${p.sku})` : ''}
                  </option>
                ))}
              </select>

              {/* Qty */}
              <div className="flex flex-col gap-0.5">
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(item._key, {
                      quantity: Math.min(
                        maxQty,
                        Math.max(1, parseInt(e.target.value) || 1)
                      ),
                    })
                  }
                  className="block w-full rounded-md border border-gray-200 py-1.5 px-2 text-sm outline-2 text-center"
                />
                <p className={`text-center text-xs ${
                  item.quantity >= maxQty && maxQty > 0
                    ? 'text-red-500'
                    : 'text-gray-400'
                }`}>
                  {maxQty === 9999 ? 0 : maxQty} in stock
                </p>
              </div>

              {/* Unit price */}
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
                    updateItem(item._key, {
                      unit_price: parseFloat(e.target.value) || 0,
                    })
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
          );
        })}
      </div>

      {/* Errors */}
      {errors?.map((error) => (
        <p className="mt-2 text-sm text-red-500" key={error}>{error}</p>
      ))}

      {/* Subtotal */}
      {/* {subtotal > 0 && (
        <div className="mt-3 flex justify-end gap-6 border-t border-gray-100 pt-3 text-sm">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-semibold text-gray-800 tabular-nums">
            ${fmt(subtotal)}
          </span>
        </div>
      )} */}
      
    </div>
  );
}