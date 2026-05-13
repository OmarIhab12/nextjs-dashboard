// app/ui/shared/contact-detail.tsx
'use client';

import { useState, useTransition } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

// ── Shared field types ────────────────────────────────────────────────────────

export type ContactData = {
  id:      string;
  name:    string;
  email:   string | null;
  phone:   string | null;
  address: string | null;
  city:    string | null;
  country: string | null;
  notes?:  string | null;  // optional — customers don't have this, suppliers do
};

export type ContactSaveInput = {
  name:     string;
  email?:   string;
  phone?:   string;
  address?: string;
  city?:    string;
  country?: string;
  notes?:   string;
};

// ── Internal sub-components ───────────────────────────────────────────────────

export function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">
        {value || <span className="text-gray-300">—</span>}
      </p>
    </div>
  );
}

export function EditInput({
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

// ── Main shared component ─────────────────────────────────────────────────────

export default function ContactDetail({
  contact,
  title,
  showNotes = false,
  onSave,
}: {
  contact:    ContactData;
  title:      string;                              // e.g. 'Customer Details' | 'Supplier Details'
  showNotes?: boolean;                             // suppliers have notes, customers don't
  onSave:     (id: string, input: ContactSaveInput) => Promise<{ error: string | null }>;
}) {
  type EditState = {
    name: string; email: string; phone: string;
    address: string; city: string; country: string; notes: string;
  };

  const fromContact = (): EditState => ({
    name:    contact.name,
    email:   contact.email   ?? '',
    phone:   contact.phone   ?? '',
    address: contact.address ?? '',
    city:    contact.city    ?? '',
    country: contact.country ?? '',
    notes:   contact.notes   ?? '',
  });

  const [editing,   setEditing]  = useState(false);
  const [error,     setError]    = useState<string | null>(null);
  const [state,     setState]    = useState<EditState>(fromContact);
  const [isPending, startTransition] = useTransition();

  const cancelEdit = () => { setState(fromContact()); setEditing(false); setError(null); };

  const save = () => {
    if (!state.name.trim()) { setError('Name is required.'); return; }
    startTransition(async () => {
      const result = await onSave(contact.id, {
        name:    state.name,
        email:   state.email   || undefined,
        phone:   state.phone   || undefined,
        address: state.address || undefined,
        city:    state.city    || undefined,
        country: state.country || undefined,
        notes:   state.notes   || undefined,
      });
      if (result.error) { setError(result.error); return; }
      setEditing(false);
      setError(null);
    });
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
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
            <button onClick={() => { setEditing(true); setError(null); }} title={`Edit ${title}`}
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
            {showNotes && (
              <div className="col-span-2 sm:col-span-3">
                <EditInput label="Notes" value={state.notes} onChange={(v) => setState((s) => ({ ...s, notes: v }))} placeholder="Any notes" />
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Name"    value={state.name} />
            <Field label="Email"   value={state.email} />
            <Field label="Phone"   value={state.phone} />
            <Field label="Address" value={state.address} />
            <Field label="City"    value={state.city} />
            <Field label="Country" value={state.country} />
            {showNotes && state.notes && (
              <div className="col-span-2 sm:col-span-3">
                <Field label="Notes" value={state.notes} />
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
