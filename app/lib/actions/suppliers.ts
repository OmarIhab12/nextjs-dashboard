'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type CreateSupplierInput,
  type UpdateSupplierInput,
} from '@/app/lib/db/suppliers';
import { createOrderPayment, buildOrderPaymentAllocations } from '@/app/lib/db/order-payments';
import { getInstalmentsByOrder } from '@/app/lib/db/order-instalments';
import { getAllOrders } from '@/app/lib/db/orders';

export async function createSupplierAction(input: CreateSupplierInput) {
  try {
    await createSupplier(input);
    revalidatePath('/dashboard/suppliers');
    return { error: null };
  } catch {
    return { error: 'Failed to create supplier.' };
  }
}

export async function updateSupplierAction(id: string, input: UpdateSupplierInput) {
  try {
    await updateSupplier(id, input);
    revalidatePath('/dashboard/suppliers');
    return { error: null };
  } catch {
    return { error: 'Failed to update supplier.' };
  }
}

export async function deleteSupplierAction(id: string) {
  try {
    await deleteSupplier(id);
    revalidatePath('/dashboard/suppliers');
    return { error: null };
  } catch {
    return { error: 'Failed to delete supplier.' };
  }
}

export async function addSupplierPaymentAction(
  supplierId: string,
  fd: FormData,
): Promise<{ error: string | null }> {
  try {
    const amount         = parseFloat(fd.get('amount') as string);
    const payment_method = fd.get('payment_method') as string;
    const reference      = (fd.get('reference') as string) || undefined;

    if (!amount || amount <= 0) return { error: 'Invalid amount.' };

    // Find the oldest unpaid order for this supplier
    const allOrders = await getAllOrders();
    const unpaidOrders = allOrders
      .filter((o) => o.supplier_id === supplierId && o.status !== 'paid')
      .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

    if (unpaidOrders.length === 0) return { error: 'No outstanding orders for this supplier.' };

    // Auto-allocate across oldest unpaid order's instalments first
    const targetOrder = unpaidOrders[0];
    const allocations = await buildOrderPaymentAllocations(targetOrder.id, amount);

    if (allocations.length === 0) return { error: 'No unpaid instalments found.' };

    await createOrderPayment({
      order_id:       targetOrder.id,
      amount_usd:     amount,
      payment_method: payment_method as any,
      reference,
      allocations,
    });

    revalidatePath(`/dashboard/suppliers/${supplierId}`);
    return { error: null };
  } catch (err) {
    console.error('addSupplierPaymentAction error:', err);
    return { error: 'Failed to record payment.' };
  }
}

