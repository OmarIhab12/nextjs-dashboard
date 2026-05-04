'use client';

import { useState, useTransition } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { updateCustomerAction } from '@/app/lib/actions/customers';
import type { Customer } from '@/app/lib/db/customers';

type EditState = {
  name:    string;
  email:   string;
  phone:   string;
  address: string;
  city:    string;
  country: string;
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

function EditInput({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 block w-full rounded-md border border-gray-300 py-1 px-2 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
      />
    </div>
  );
}

export default function CustomerDetail({ customer }: { customer: Customer }) {
  const [editing, setEditing]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [state, setState] = useState<EditState>({
    name:    customer.name,
    email:   customer.email    ?? '',
    phone:   customer.phone    ?? '',
    address: customer.address  ?? '',
    city:    customer.city     ?? '',
    country: customer.country  ?? '',
  });

  const startEdit  = () => { setEditing(true); setError(null); };
  const cancelEdit = () => {
    setState({
      name:    customer.name,
      email:   customer.email    ?? '',
      phone:   customer.phone    ?? '',
      address: customer.address  ?? '',
      city:    customer.city     ?? '',
      country: customer.country  ?? '',
    });
    setEditing(false);
    setError(null);
  };

  const save = () => {
    if (!state.name.trim()) { setError('Name is required.'); return; }
    startTransition(async () => {
      try {
        await updateCustomerAction(customer.id, {
          name:    state.name,
          email:   state.email   || undefined,
          phone:   state.phone   || undefined,
          address: state.address || undefined,
          city:    state.city    || undefined,
          country: state.country || undefined,
        });
        setEditing(false);
        setError(null);
      } catch {
        setError('Failed to save. Please try again.');
      }
    });
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Customer Details</h2>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={save} disabled={isPending} title="Save"
                className="rounded-md p-1.5 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors">
                <CheckIcon className="h-4 w-4" />
              </button>
              <button onClick={cancelEdit} disabled={isPending} title="Cancel"
                className="rounded-md p-1.5 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={startEdit} title="Edit customer"
              className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
              <PencilIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
        {editing ? (
          <>
            <EditInput label="Name"    value={state.name}    onChange={(v) => setState((s) => ({ ...s, name: v }))}    placeholder="Full name" />
            <EditInput label="Email"   value={state.email}   onChange={(v) => setState((s) => ({ ...s, email: v }))}   placeholder="email@example.com" type="email" />
            <EditInput label="Phone"   value={state.phone}   onChange={(v) => setState((s) => ({ ...s, phone: v }))}   placeholder="+1 234 567" />
            <EditInput label="Address" value={state.address} onChange={(v) => setState((s) => ({ ...s, address: v }))} placeholder="Street address" />
            <EditInput label="City"    value={state.city}    onChange={(v) => setState((s) => ({ ...s, city: v }))}    placeholder="City" />
            <EditInput label="Country" value={state.country} onChange={(v) => setState((s) => ({ ...s, country: v }))} placeholder="Country" />
          </>
        ) : (
          <>
            <Field label="Name"    value={state.name} />
            <Field label="Email"   value={state.email} />
            <Field label="Phone"   value={state.phone} />
            <Field label="Address" value={state.address} />
            <Field label="City"    value={state.city} />
            <Field label="Country" value={state.country} />
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}