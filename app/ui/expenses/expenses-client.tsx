'use client';

// app/ui/expenses/expenses-client.tsx

import { useState, useTransition } from 'react';
import {
  PlusIcon, PencilIcon, CheckIcon,
  XMarkIcon, NoSymbolIcon,
} from '@heroicons/react/24/outline';
import {
  createExpenseAction,
  updateExpenseAction,
  deactivateExpenseAction,
} from '@/app/lib/actions/expenses';
import type { Expense, ExpenseType } from '@/app/lib/db/expenses';
import {
  TableContainer, TableRows, TableActions, TableEmpty,
} from '@/app/ui/table-components';
import { ExpensesTypeUI, PayementMethodUI } from '../shared/status';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── Expense type config ───────────────────────────────────────────────────────

const EXPENSE_TYPES: { value: ExpenseType; label: string; color: string }[] = [
  { value: 'operating', label: 'Operating', color: 'bg-blue-50 text-blue-700'    },
  { value: 'payroll',   label: 'Payroll',   color: 'bg-green-50 text-green-700'  },
  { value: 'tax',       label: 'Tax',       color: 'bg-red-50 text-red-600'      },
  { value: 'other',     label: 'Other',     color: 'bg-gray-100 text-gray-600'   },
];

const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank'          },
  { value: 'cash',          label: 'Cash'          },
  { value: 'check',         label: 'Check'         },
  { value: 'vodafone_cash', label: 'Vodafone Cash' },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    bank_transfer: 'bg-blue-50 text-blue-700',
    cash:          'bg-green-50 text-green-700',
    check:         'bg-purple-50 text-purple-700',
    vodafone_cash: 'bg-red-50 text-red-600',
  };
  const label = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[method] ?? 'bg-gray-100 text-gray-500'}`}>
      {label}
    </span>
  );
}

// function ExpenseTypeBadge({ type }: { type: ExpenseType }) {
//   const config = EXPENSE_TYPES.find((t) => t.value === type) ?? EXPENSE_TYPES[4];
//   return (
//     <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
//       {config.label}
//     </span>
//   );
// }

// ── Types ─────────────────────────────────────────────────────────────────────

type RowMode = 'view' | 'edit' | 'new';

type EditState = {
  category:       string;
  expense_type:   ExpenseType;
  payment_method: string;
  amount_egp:     string;
  description:    string;
};

type ExpenseRowEntry = Expense & { _key: string; mode: RowMode };

function toEditState(e: Expense): EditState {
  return {
    category:       e.category,
    expense_type:   e.expense_type,
    payment_method: e.payment_method,
    amount_egp:     String(e.amount_egp),
    description:    e.description ?? '',
  };
}

function emptyEditState(): EditState {
  return { category: '', expense_type: 'other', payment_method: 'cash', amount_egp: '', description: '' };
}

// ── EditInput ─────────────────────────────────────────────────────────────────

function EditInput({
  value, onChange, placeholder, type = 'text', className = '',
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type} value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      step={type === 'number' ? '0.01' : undefined}
      min={type === 'number' ? '0' : undefined}
      className={`block w-full rounded-md border border-gray-300 bg-white py-1 px-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500 ${className}`}
    />
  );
}

function TypeSelect({
  value, onChange,
}: {
  value: ExpenseType; onChange: (v: ExpenseType) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ExpenseType)}
      className="block w-full rounded-md border border-gray-300 bg-white py-1 px-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
    >
      {EXPENSE_TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
  );
}

// ── Expense Table ─────────────────────────────────────────────────────────────

function ExpenseTable({
  expenses,
  recurrence,
}: {
  expenses:   Expense[];
  recurrence: 'once' | 'monthly';
}) {
  const showNextDue = recurrence === 'monthly';
  const COLS = showNextDue
    ? 'grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_5rem]'
    : 'grid-cols-[2fr_1fr_1fr_1fr_1fr_5rem]';

  const [rows,       setRows]       = useState<ExpenseRowEntry[]>(
    expenses.map((e) => ({ ...e, _key: e.id, mode: 'view' as RowMode }))
  );
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [isPending,  startTransition] = useTransition();

  const setEdit  = (key: string, patch: Partial<EditState>) =>
    setEditStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  const setError = (key: string, msg: string) =>
    setErrors((prev) => ({ ...prev, [key]: msg }));
  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  const setMode = (key: string, mode: RowMode) =>
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, mode } : r));

  const addNewRow = () => {
    if (rows.some((r) => r.mode === 'new')) return;
    const key = uid();
    const blank: ExpenseRowEntry = {
      _key: key, id: '', mode: 'new',
      category: '', expense_type: 'other', payment_method: 'cash', recurrence,
      amount_egp: '0', description: null,
      expense_date: new Date().toISOString(),
      next_due_date: null, is_active: true, created_at: '',
    };
    setRows((prev) => [blank, ...prev]);
    setEditStates((prev) => ({ ...prev, [key]: emptyEditState() }));
  };

  const startEdit = (row: ExpenseRowEntry) => {
    setEditStates((prev) => ({ ...prev, [row._key]: toEditState(row) }));
    setMode(row._key, 'edit');
  };

  const cancelEdit = (row: ExpenseRowEntry) => {
    if (row.mode === 'new') {
      setRows((prev) => prev.filter((r) => r._key !== row._key));
    } else {
      clearError(row._key);
      setMode(row._key, 'view');
    }
    setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
  };

  const validate = (key: string, state: EditState): boolean => {
    if (!state.category.trim())                 { setError(key, 'Category is required.'); return false; }
    if (!state.amount_egp || parseFloat(state.amount_egp) <= 0) {
      setError(key, 'Amount must be greater than zero.'); return false;
    }
    return true;
  };

  const saveNew = (row: ExpenseRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('category',       state.category);
      fd.set('expense_type',   state.expense_type);
      fd.set('payment_method', state.payment_method);
      fd.set('recurrence',     recurrence);
      fd.set('amount_egp',     state.amount_egp);
      fd.set('description',    state.description);
      const result = await createExpenseAction(fd);
      if (result.error) { setError(row._key, result.error); return; }
      setRows((prev) => prev.filter((r) => r._key !== row._key));
      setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
      clearError(row._key);
    });
  };

  const saveEdit = (row: ExpenseRowEntry) => {
    const state = editStates[row._key];
    if (!validate(row._key, state)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('category',       state.category);
      fd.set('expense_type',   state.expense_type);
      fd.set('payment_method', state.payment_method);
      fd.set('amount_egp',     state.amount_egp);
      fd.set('description',    state.description);
      const result = await updateExpenseAction(row.id, fd);
      if (result.error) { setError(row._key, result.error); return; }
      setRows((prev) => prev.map((r) =>
        r._key === row._key
          ? { ...r, category: state.category, expense_type: state.expense_type,
              amount_egp: state.amount_egp, description: state.description || null,
              mode: 'view' }
          : r
      ));
      clearError(row._key);
      setEditStates((prev) => { const n = { ...prev }; delete n[row._key]; return n; });
    });
  };

  const handleDeactivate = (row: ExpenseRowEntry) => {
    if (!confirm(`Deactivate "${row.category}"?`)) return;
    startTransition(async () => {
      const result = await deactivateExpenseAction(row.id);
      if (result.error) { setError(row._key, result.error); return; }
      setRows((prev) => prev.map((r) =>
        r._key === row._key ? { ...r, is_active: false } : r
      ));
    });
  };

  return (
    <div className="mt-4 flow-root">
      <TableContainer>
        {/* Header with + button */}
        <div className={`grid ${COLS} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
          <span>Category</span>
          <span>Type</span>
          <span>Via</span>
          <span>Amount (EGP)</span>
          <span>Date</span>
          {showNextDue && <span>Next Due</span>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addNewRow}
              disabled={isPending || rows.some((r) => r.mode === 'new')}
              title="Add expense"
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
                <div className={`grid ${COLS} items-center gap-2 px-3 py-2 transition-colors ${
                  isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50/50'
                } ${!row.is_active && !isEditing ? 'opacity-50' : ''}`}>

                  {/* Category + description */}
                  {isEditing ? (
                    <div className="flex flex-col gap-1">
                      <EditInput
                        value={state.category}
                        onChange={(v) => setEdit(row._key, { category: v })}
                        placeholder="Category"
                      />
                      <EditInput
                        value={state.description}
                        onChange={(v) => setEdit(row._key, { description: v })}
                        placeholder="Description (optional)"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col py-1">
                      <span className="text-sm font-medium text-gray-800">{row.category}</span>
                      {row.description && (
                        <span className="text-xs text-gray-400 line-clamp-1">{row.description}</span>
                      )}
                    </div>
                  )}

                  {/* Type */}
                  {isEditing ? (
                    <TypeSelect
                      value={state.expense_type}
                      onChange={(v) => setEdit(row._key, { expense_type: v })}
                    />
                  ) : (
                    <div className="ml-1">                
                      <ExpensesTypeUI type={row.expense_type} />
                    </div>
                  )}

                  {/* Payment method */}
                  {isEditing ? (
                    <select
                      value={state.payment_method}
                      onChange={(e) => setEdit(row._key, { payment_method: e.target.value })}
                      className="block w-full rounded-md border border-gray-300 bg-white py-1 px-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="ml-1">  
                    <PayementMethodUI payment_method={row.payment_method} />
                    </div>
                  )}

                  {/* Amount */}
                  {isEditing ? (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">EGP</span>
                      <EditInput
                        value={state.amount_egp}
                        onChange={(v) => setEdit(row._key, { amount_egp: v })}
                        type="number" placeholder="0.00" className="pl-10"
                      />
                    </div>
                  ) : (
                    <span className="text-sm tabular-nums text-gray-700">
                      EGP {fmt(Number(row.amount_egp))}
                    </span>
                  )}

                  {/* Date */}
                  <span className="text-sm text-gray-500">
                    {row.expense_date ? fmtDate(row.expense_date) : '—'}
                  </span>

                  {/* Next due */}
                  {showNextDue && (
                    <span className="text-sm text-gray-500">
                      {row.next_due_date ? fmtDate(row.next_due_date) : '—'}
                    </span>
                  )}

                  {/* Actions */}
                  <TableActions>
                    {isEditing ? (
                      <>
                        <button type="button"
                          onClick={() => row.mode === 'new' ? saveNew(row) : saveEdit(row)}
                          disabled={isPending} title="Save"
                          className="rounded-md p-1.5 bg-green-50 text-green-600 hover:bg-green-100 disabled:opacity-50 transition-colors">
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button type="button"
                          onClick={() => cancelEdit(row)}
                          disabled={isPending} title="Cancel"
                          className="rounded-md p-1.5 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors">
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(row)} title="Edit"
                          className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {row.is_active && (
                          <button type="button"
                            onClick={() => handleDeactivate(row)}
                            disabled={isPending} title="Deactivate"
                            className="rounded-md p-1.5 bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors">
                            <NoSymbolIcon className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </TableActions>
                </div>
                {error && <p className="px-3 pb-2 text-xs text-red-500">{error}</p>}
              </div>
            );
          })}
          {rows.length === 0 && (
            <TableEmpty message={`No ${recurrence === 'once' ? 'one-off' : 'monthly'} expenses yet.`} />
          )}
        </TableRows>
      </TableContainer>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'once' | 'monthly';

export default function ExpensesClient({
  once,
  monthly,
}: {
  once:    Expense[];
  monthly: Expense[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>('once');

  const totalOnce    = once.reduce((s, e) => s + Number(e.amount_egp), 0);
  const totalMonthly = monthly.filter((e) => e.is_active).reduce((s, e) => s + Number(e.amount_egp), 0);

  return (
    <div className="space-y-4">
      {/* ── Tabs ── */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {(['once', 'monthly'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab === 'once' ? 'One-off' : 'Monthly'}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {activeTab === 'once' ? (
          <>
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">Total one-off</p>
              <p className="text-sm font-semibold tabular-nums text-gray-800">EGP {fmt(totalOnce)}</p>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">Count</p>
              <p className="text-sm font-semibold text-gray-800">{once.length}</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">Monthly total (active)</p>
              <p className="text-sm font-semibold tabular-nums text-gray-800">EGP {fmt(totalMonthly)}</p>
            </div>
            <div className="rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs text-gray-400">Active recurring</p>
              <p className="text-sm font-semibold text-gray-800">{monthly.filter((e) => e.is_active).length}</p>
            </div>
          </>
        )}
      </div>

      {/* ── Table ── */}
      {activeTab === 'once'
        ? <ExpenseTable key="once"    expenses={once}    recurrence="once" />
        : <ExpenseTable key="monthly" expenses={monthly} recurrence="monthly" />
      }
    </div>
  );
}