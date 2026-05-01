'use client';

import { useState, useTransition } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { createCustomerAction, updateCustomerAction } from '@/app/lib/actions/customers';
import { TableContainer, TableRows, TableActions, TableEmpty } from '@/app/ui/table-components';

// ── Types ─────────────────────────────────────────────────────
export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
};

type EditState = {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
};

type RowMode = 'view' | 'edit' | 'new';
type CustomerRowEntry = CustomerRow & { _key: string; mode: RowMode };

// ── Helpers ───────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);

const toEditState = (c: CustomerRow): EditState => ({
  name:    c.name,
  email:   c.email    ?? '',
  phone:   c.phone    ?? '',
  address: c.address  ?? '',
  city:    c.city     ?? '',
  country: c.country  ?? '',
});

const emptyEditState = (): EditState => ({
  name: '', email: '', phone: '', address: '', city: '', country: '',
});

// ── EditInput ─────────────────────────────────────────────────
function EditInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="block w-full rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
    />
  );
}

// ── Main Component ────────────────────────────────────────────
export default function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [rows, setRows]           = useState<CustomerRowEntry[]>(
    customers.map((c) => ({ ...c, _key: c.id, mode: 'view' }))
  );
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [isPending,  startTransition] = useTransition();

  // ── Helpers ────────────────────────────────────────────────
  const setEdit  = (key: string, patch: Partial<EditState>) =>
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
      setError(key, 'Customer name is required.');
      return false;
    }
    if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
      setError(key, 'Please enter a valid email address.');
      return false;
    }
    clearError(key);
    return true;
  }

  // ── Start edit ─────────────────────────────────────────────
  const startEdit = (row: CustomerRowEntry) => {
    setEditStates((prev) => ({ ...prev, [row._key]: toEditState(row) }));
    setMode(row._key, 'edit');
  };

  // ── Cancel ─────────────────────────────────────────────────
  const cancelEdit = (row: CustomerRowEntry) => {
    if (row.mode === 'new') {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
    } else {
      clearError(row._key);
      setMode(row._key, 'view');
    }
    setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
  };

  // ── Save existing ──────────────────────────────────────────
  const saveEdit = (row: CustomerRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;

    startTransition(async () => {
      try {
        const updated = await updateCustomerAction(row.id, {
          name:    state.name,
          email:   state.email   || undefined,
          phone:   state.phone   || undefined,
          address: state.address || undefined,
          city:    state.city    || undefined,
          country: state.country || undefined,
        });

        if (!updated) { setError(row._key, 'Failed to update customer.'); return; }

        setRows((prev) =>
          prev.map((r) => r._key === row._key ? { ...r, ...updated, mode: 'view' } : r)
        );
        clearError(row._key);
        setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
      } catch {
        setError(row._key, 'An error occurred. Please try again.');
      }
    });
  };

  // ── Save new ───────────────────────────────────────────────
  const saveNew = (row: CustomerRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;

    startTransition(async () => {
      try {
        const created = await createCustomerAction({
          name:    state.name,
          email:   state.email   || undefined,
          phone:   state.phone   || undefined,
          address: state.address || undefined,
          city:    state.city    || undefined,
          country: state.country || undefined,
        });

        setRows((prev) =>
          prev.map((r) =>
            r._key === row._key
              ? { ...r, ...created, id: created.id, _key: created.id, mode: 'view' }
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

  // ── Add new row ────────────────────────────────────────────
  const addNewRow = () => {
    if (rows.some((r) => r.mode === 'new')) return;
    const key = uid();
    setRows((prev) => [{
      _key: key, id: '', mode: 'new',
      name: '', email: null, phone: null, address: null, city: null, country: null,
    }, ...prev]);
    setEditStates((prev) => ({ ...prev, [key]: emptyEditState() }));
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="mt-6 flow-root">
      <TableContainer>

        {/* Column headers */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Address</span>
          <span>City</span>
          <span>Country</span>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addNewRow}
              disabled={isPending || rows.some((r) => r.mode === 'new')}
              title="Add new customer"
              className="rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <TableRows>
          {rows.map((row) => {
            const isEditing = row.mode === 'edit' || row.mode === 'new';
            const state     = editStates[row._key];
            const error     = errors[row._key];

            return (
              <div key={row._key}>
                <div className={`grid grid-cols-[2fr_2fr_1fr_1fr_1fr_1fr_5rem] items-center gap-2 px-3 py-2 transition-colors ${
                  isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'
                }`}>

                  {/* Name */}
                  {isEditing ? (
                    <EditInput value={state.name} onChange={(v) => setEdit(row._key, { name: v })} placeholder="Full name" />
                  ) : (
                    <span className="text-sm font-medium text-gray-800 truncate">{row.name}</span>
                  )}

                  {/* Email */}
                  {isEditing ? (
                    <EditInput value={state.email} onChange={(v) => setEdit(row._key, { email: v })} placeholder="email@example.com" type="email" />
                  ) : (
                    <span className="text-sm text-gray-500 truncate">
                      {row.email ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* Phone */}
                  {isEditing ? (
                    <EditInput value={state.phone} onChange={(v) => setEdit(row._key, { phone: v })} placeholder="+1 234 567" />
                  ) : (
                    <span className="text-sm text-gray-500">
                      {row.phone ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* Address */}
                  {isEditing ? (
                    <EditInput value={state.address} onChange={(v) => setEdit(row._key, { address: v })} placeholder="Street address" />
                  ) : (
                    <span className="text-sm text-gray-500 truncate">
                      {row.address ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* City */}
                  {isEditing ? (
                    <EditInput value={state.city} onChange={(v) => setEdit(row._key, { city: v })} placeholder="City" />
                  ) : (
                    <span className="text-sm text-gray-500">
                      {row.city ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* Country */}
                  {isEditing ? (
                    <EditInput value={state.country} onChange={(v) => setEdit(row._key, { country: v })} placeholder="Country" />
                  ) : (
                    <span className="text-sm text-gray-500">
                      {row.country ?? <span className="text-gray-300">—</span>}
                    </span>
                  )}

                  {/* Actions */}
                  <TableActions>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => row.mode === 'new' ? saveNew(row) : saveEdit(row)}
                          disabled={isPending}
                          title="Save changes"
                          className="rounded-md p-1.5 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(row)}
                          disabled={isPending}
                          title="Cancel"
                          className="rounded-md p-1.5 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        title="Edit customer"
                        className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    )}
                  </TableActions>
                </div>

                {/* Per-row error */}
                {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
              </div>
            );
          })}

          {rows.length === 0 && <TableEmpty message="No customers found." />}
        </TableRows>

      </TableContainer>
    </div>
  );
}