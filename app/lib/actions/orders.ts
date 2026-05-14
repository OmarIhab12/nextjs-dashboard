'use server';

import { revalidatePath } from 'next/cache';
import { redirect }        from 'next/navigation';
import { z }               from 'zod';
import { createOrder, updateOrder, deleteOrder } from '@/app/lib/db/orders';
import { replaceOrderItems }                     from '@/app/lib/db/order-items';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderState = {
  errors: {
    supplier_id?: string[];
    items?:       string[];
    due_date?:    string[];
    status?:      string[];
    notes?:       string[];
  };
  message: string | null;
};

// Define initialState in your form components, not here:
// const initialState: OrderState = { errors: {}, message: null };

// ── Validation ────────────────────────────────────────────────────────────────

const OrderSchema = z.object({
  supplier_id: z.string().uuid('Please select a supplier.').optional().or(z.literal('')),
  due_date:    z.string().optional(),
  status:      z.enum(
    ['pending', 'confirmed', 'shipped', 'arrived', 'stored', 'cancelled'],
    { errorMap: () => ({ message: 'Invalid status.' }) }
  ),
  notes: z.string().optional(),
});

const ItemSchema = z.array(
  z.object({
    product_id:        z.string().uuid(),
    product_name:      z.string(),
    unit_price:        z.number().positive(),
    quantity:          z.number().int().positive(),
    original_quantity: z.number().optional(),
  })
).min(1, 'At least one product is required.');

function parseItems(formData: FormData): ReturnType<typeof ItemSchema.safeParse> {
  try {
    const raw = JSON.parse((formData.get('items') as string) ?? '[]');
    return ItemSchema.safeParse(raw);
  } catch {
    return ItemSchema.safeParse([]);
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createOrderAction(
  prevState: OrderState,
  formData:  FormData,
): Promise<OrderState> {
  const parsed      = OrderSchema.safeParse(Object.fromEntries(formData));
  const parsedItems = parseItems(formData);

  const errors: OrderState['errors'] = {};
  if (!parsed.success)      Object.assign(errors, parsed.error.flatten().fieldErrors);
  if (!parsedItems.success) errors.items = parsedItems.error.flatten().formErrors;
  if (Object.keys(errors).length > 0) return { errors, message: 'Please fix the errors above.' };

  const { supplier_id, due_date, status, notes } = parsed.data!;
  const items     = parsedItems.data!;
  const total_usd = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

  try {
    const order = await createOrder({
      supplier_id: supplier_id || undefined,
      total_usd,
      notes:       notes || undefined,
      order_date:  due_date ? new Date(due_date) : undefined,
    });

    // Save items first — so stock trigger on status change can see them
    await replaceOrderItems(order.id, items);

    // Now set status — if stored, trigger increments stock
    if (status !== 'pending') {
      await updateOrder(order.id, { status: status as any });
    }
  } catch (err) {
    console.error('createOrderAction:', err);
    return { errors: {}, message: 'Database error: failed to create order.' };
  }

  revalidatePath('/dashboard/orders');
  redirect('/dashboard/orders');
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateOrderAction(
  prevState: OrderState,
  id:        string,
  formData:  FormData,
): Promise<OrderState> {
  const parsed      = OrderSchema.safeParse(Object.fromEntries(formData));
  const parsedItems = parseItems(formData);

  const errors: OrderState['errors'] = {};
  if (!parsed.success)      Object.assign(errors, parsed.error.flatten().fieldErrors);
  if (!parsedItems.success) errors.items = parsedItems.error.flatten().formErrors;
  if (Object.keys(errors).length > 0) return { errors, message: 'Please fix the errors above.' };

  const { supplier_id, notes, status } = parsed.data!;
  const items = parsedItems.data!;

  try {
    // Update items first — if currently stored, item triggers handle stock diff
    await replaceOrderItems(id, items);
    // Then update order — status trigger handles stock on stored transition
    await updateOrder(id, {
      supplier_id: supplier_id || undefined,
      notes:       notes || undefined,
      status:      status as any,
    });
  } catch (err) {
    console.error('updateOrderAction:', err);
    return { errors: {}, message: 'Database error: failed to update order.' };
  }

  revalidatePath('/dashboard/orders');
  redirect('/dashboard/orders');
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteOrderAction(id: string): Promise<void> {
  try {
    await deleteOrder(id);
    revalidatePath('/dashboard/orders');
  } catch (err) {
    console.error('deleteOrderAction:', err);
  }
}