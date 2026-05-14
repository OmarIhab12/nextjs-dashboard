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
    const category   = formData.get('category')   as string;
    const recurrence = formData.get('recurrence')  as 'once' | 'monthly';
    const amount_egp = parseFloat(formData.get('amount_egp') as string);
    const description = formData.get('description') as string;

    if (!category?.trim())       return { error: 'Category is required.' };
    if (!amount_egp || amount_egp <= 0) return { error: 'Amount must be greater than zero.' };
    if (!['once', 'monthly'].includes(recurrence)) return { error: 'Invalid recurrence.' };

    await createExpense({
      category:    category.trim(),
      recurrence,
      amount_egp,
      description: description?.trim() || undefined,
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
    const category    = formData.get('category')    as string;
    const amount_egp  = parseFloat(formData.get('amount_egp') as string);
    const description = formData.get('description') as string;

    if (!category?.trim())            return { error: 'Category is required.' };
    if (!amount_egp || amount_egp <= 0) return { error: 'Amount must be greater than zero.' };

    await updateExpense(id, {
      category:    category.trim(),
      amount_egp,
      description: description?.trim() || undefined,
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