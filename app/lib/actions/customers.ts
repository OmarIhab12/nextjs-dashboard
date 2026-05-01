'use server';

import { createCustomer, updateCustomer } from '@/app/lib/db/customers';
import type { CreateCustomerInput, UpdateCustomerInput } from '@/app/lib/db/customers';

export async function createCustomerAction(input: CreateCustomerInput) {
  return await createCustomer(input);
}

export async function updateCustomerAction(id: string, input: UpdateCustomerInput) {
  return await updateCustomer(id, input);
}