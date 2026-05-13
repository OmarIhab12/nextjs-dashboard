'use server';

import { addPaymentForCustomer, createCustomer, updateCustomer } from '@/app/lib/db/customers';
import type { CreateCustomerInput, UpdateCustomerInput } from '@/app/lib/db/customers';
import { revalidatePath } from 'next/cache';

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
  const amount        = parseFloat(formData.get('amount') as string);
  const paymentMethod = formData.get('payment_method') as string;
  const reference     = formData.get('reference') as string || undefined;
 
  console.log('>>> addCustomerPaymentAction', { customerId, amount, paymentMethod });
  
  if (!amount || amount <= 0) {
    return { error: 'Please enter a valid amount.' };
  }
  if (!paymentMethod) {
    return { error: 'Please select a payment method.' };
  }
 
  await addPaymentForCustomer(customerId, amount, paymentMethod, reference);
  revalidatePath(`/dashboard/customers/${customerId}`);
  return { error: null };
}