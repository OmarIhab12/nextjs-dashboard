// app/ui/customers/add-customer-button.tsx
'use client';

import { useState, useTransition } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { createCustomerAction } from '@/app/lib/actions/customers';

type State = {
  name:    string;
  email:   string;
  phone:   string;
  address: string;
  city:    string;
  country: string;
};

const EMPTY: State = {
  name: '', email: '', phone: '', address: '', city: '', country: '',
};

function Field({
  label, value, onChange, placeholder, type = 'text', required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 py-1.5 px-2 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
      />
    </div>
  );
}

export default function AddCustomerButton() {
  const [open,      setOpen]     = useState(false);
  const [state,     setState]    = useState<State>(EMPTY);
  const [error,     setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const close = () => { setOpen(false); setState(EMPTY); setError(null); };

  const handleSubmit = () => {
    if (!state.name.trim()) { setError('Name is required.'); return; }
    startTransition(async () => {
      const result = await createCustomerAction({
        name:    state.name,
        email:   state.email   || undefined,
        phone:   state.phone   || undefined,
        address: state.address || undefined,
        city:    state.city    || undefined,
        country: state.country || undefined,
      });
      if (result.error) { setError(result.error); return; }
      close();
    });
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <PlusIcon className="h-4 w-4" />
        Add Customer
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-800">New Customer</h2>
              <button onClick={close} className="btn-icon text-gray-400 hover:bg-gray-100">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="grid grid-cols-2 gap-4 px-6 py-4">
              <div className="col-span-2">
                <Field label="Name" value={state.name} onChange={(v) => setState((s) => ({ ...s, name: v }))} placeholder="Customer name" required />
              </div>
              <Field label="Email"   value={state.email}   onChange={(v) => setState((s) => ({ ...s, email: v }))}   placeholder="email@example.com" type="email" />
              <Field label="Phone"   value={state.phone}   onChange={(v) => setState((s) => ({ ...s, phone: v }))}   placeholder="+1 234 567" />
              <Field label="Address" value={state.address} onChange={(v) => setState((s) => ({ ...s, address: v }))} placeholder="Street address" />
              <Field label="City"    value={state.city}    onChange={(v) => setState((s) => ({ ...s, city: v }))}    placeholder="City" />
              <div className="col-span-2">
                <Field label="Country" value={state.country} onChange={(v) => setState((s) => ({ ...s, country: v }))} placeholder="Country" />
              </div>
            </div>

            {error && <p className="px-6 pb-2 text-sm text-red-500">{error}</p>}

            {/* Modal footer */}
            <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={close} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={isPending} className="btn-primary">
                {isPending ? 'Saving…' : 'Save Customer'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
