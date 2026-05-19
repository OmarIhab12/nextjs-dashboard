'use server';

import { revalidatePath }  from 'next/cache';
import {
  createExpense,
  updateExpense,
  deactivateExpense,
  fireMonthlyExpense,
  getDueMonthlyExpenses,
} from '@/app/lib/db/expenses';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExpenseFormState = {
  error: string | null;
};

// ── Create ────────────────────────────────────────────────────────────────────

export async function createExpenseAction(
  formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const category       = formData.get('category')       as string;
    const expense_type   = formData.get('expense_type')   as string;
    const payment_method = formData.get('payment_method') as string;
    const recurrence     = formData.get('recurrence')     as 'once' | 'monthly';
    const amount         = parseFloat(formData.get('amount') as string);
    const currency       = formData.get('currency')       as string || 'EGP';
    const description    = formData.get('description')    as string;

    if (!category?.trim())          return { error: 'Category is required.' };
    if (!expense_type)              return { error: 'Expense type is required.' };
    if (!payment_method)            return { error: 'Payment method is required.' };
    if (!amount || amount <= 0)     return { error: 'Amount must be greater than zero.' };
    if (!['once', 'monthly'].includes(recurrence))          return { error: 'Invalid recurrence.' };
    if (!['EGP', 'USD', 'RMB'].includes(currency))          return { error: 'Invalid currency.' };

    await createExpense({
      category:       category.trim(),
      expense_type:   expense_type   as any,
      payment_method: payment_method as any,
      recurrence,
      amount,
      currency:       currency as any,
      description:    description?.trim() || undefined,
    });

    revalidatePath('/dashboard/expenses');
    return { error: null };
  } catch (err) {
    console.error('createExpenseAction:', err);
    return { error: 'Failed to create expense.' };
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateExpenseAction(
  id: string,
  formData: FormData,
): Promise<ExpenseFormState> {
  try {
    const category       = formData.get('category')       as string;
    const expense_type   = formData.get('expense_type')   as string;
    const payment_method = formData.get('payment_method') as string;
    const amount         = parseFloat(formData.get('amount') as string);
    const currency       = formData.get('currency')       as string || 'EGP';
    const description    = formData.get('description')    as string;

    if (!category?.trim())      return { error: 'Category is required.' };
    if (!expense_type)          return { error: 'Expense type is required.' };
    if (!payment_method)        return { error: 'Payment method is required.' };
    if (!amount || amount <= 0) return { error: 'Amount must be greater than zero.' };
    if (!['EGP', 'USD', 'RMB'].includes(currency)) return { error: 'Invalid currency.' };

    await updateExpense(id, {
      category:       category.trim(),
      expense_type:   expense_type   as any,
      payment_method: payment_method as any,
      amount,
      currency:       currency as any,
      description:    description?.trim() || undefined,
    });

    revalidatePath('/dashboard/expenses');
    return { error: null };
  } catch (err) {
    console.error('updateExpenseAction:', err);
    return { error: 'Failed to update expense.' };
  }
}

// ── Deactivate ────────────────────────────────────────────────────────────────

export async function deactivateExpenseAction(
  id: string,
): Promise<ExpenseFormState> {
  try {
    await deactivateExpense(id);
    revalidatePath('/dashboard/expenses');
    return { error: null };
  } catch (err) {
    console.error('deactivateExpenseAction:', err);
    return { error: 'Failed to deactivate expense.' };
  }
}

// ── Auto-fire due monthly expenses ────────────────────────────────────────────
// Called on page load — silently fires any monthly expenses whose
// next_due_date is today or earlier.

export async function autoFireDueExpensesAction(): Promise<void> {
  try {
    const due = await getDueMonthlyExpenses();
    await Promise.all(due.map((e) => fireMonthlyExpense(e.id)));
    if (due.length > 0) revalidatePath('/dashboard/expenses');
  } catch (err) {
    console.error('autoFireDueExpensesAction:', err);
  }
}