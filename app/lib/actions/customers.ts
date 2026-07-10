'use server';

import { addPaymentForCustomer, refundCustomerCredit, createCustomer, updateCustomer } from '@/app/lib/db/customers';
import type { CreateCustomerInput, UpdateCustomerInput } from '@/app/lib/db/customers';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

export async function createCustomerAction(
  input: CreateCustomerInput,
): Promise<{ error: string | null }> {
  try {
    await createCustomer(input);
    revalidatePath('/dashboard/customers');
    return { error: null };
  } catch {
    return { error: 'Failed to create customer.' };
  }
}

export async function updateCustomerAction(id: string, input: UpdateCustomerInput) {
  try {
      await updateCustomer(id, input);
      revalidatePath('/dashboard/customers');
      return { error: null };
    } catch {
      return { error: 'Failed to update customer.' };
    }
}

export async function addCustomerPaymentAction(
  customerId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'You must be signed in.' };

  const amount        = parseFloat(formData.get('amount') as string);
  const paymentMethod = formData.get('payment_method') as string;
  const reference     = formData.get('reference') as string || undefined;

  if (!amount || amount <= 0) return { error: 'Please enter a valid amount.' };
  if (!paymentMethod)         return { error: 'Please select a payment method.' };

  await addPaymentForCustomer(customerId, amount, paymentMethod, session.user.id, reference);
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { error: null };
}

export async function refundCustomerCreditAction(
  customerId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'You must be signed in.' };

  const amount    = parseFloat(formData.get('amount') as string);
  const accountId = formData.get('account_id') as string;
  const notes     = formData.get('notes') as string || undefined;

  if (!amount || amount <= 0) return { error: 'Please enter a valid amount.' };
  if (!accountId)             return { error: 'Please select which account to pay from.' };

  try {
    await refundCustomerCredit(customerId, amount, accountId, session.user.id, notes);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to refund credit.' };
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
  return { error: null };
}