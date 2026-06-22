'use server';
import sql from "../db";
import postgres from "postgres";
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getInvoiceById } from './invoices';

// ── Types ─────────────────────────────────────────────────────

export type ReturnResolution = 'credit' | 'cash_refund';

export interface Return {
  id: string;
  invoice_id: string;
  created_by: string;
  credit_amount: string;
  resolution_type: ReturnResolution;
  reason: string | null;
  notes: string | null;
  created_at: Date;
}

export interface ReturnItem {
  id: string;
  return_id: string;
  invoice_item_id: string | null;
  product_id: string | null;
  product_name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface ReturnWithItems extends Return {
  items: ReturnItem[];
}

export interface CreateReturnItemInput {
  invoice_item_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface CreateReturnInput {
  invoice_id: string;
  created_by: string;
  resolution_type: ReturnResolution;
  items: CreateReturnItemInput[];
  reason?: string;
  notes?: string;
}

export type ReturnState = {
  errors: {
    items?: string[];
    resolution_type?: string[];
    reason?: string[];
    general?: string[];
  };
  message: string | null;
};

// ── Queries ───────────────────────────────────────────────────

export async function getReturnsByInvoice(invoiceId: string): Promise<ReturnWithItems[]> {
  const returns = await sql<Return[]>`
    SELECT * FROM returns
    WHERE invoice_id = ${invoiceId}
    ORDER BY created_at DESC
  `;

  const result: ReturnWithItems[] = [];
  for (const r of returns) {
    const items = await sql<ReturnItem[]>`
      SELECT * FROM return_items WHERE return_id = ${r.id}
    `;
    result.push({ ...r, items });
  }
  return result;
}

export async function getReturnById(id: string): Promise<ReturnWithItems | null> {
  const [r] = await sql<Return[]>`SELECT * FROM returns WHERE id = ${id}`;
  if (!r) return null;
  const items = await sql<ReturnItem[]>`SELECT * FROM return_items WHERE return_id = ${id}`;
  return { ...r, items };
}

/**
 * Returns the total quantity already returned per invoice_item_id for a given invoice.
 * Used to validate that new return quantities don't exceed remaining returnable quantities.
 */
export async function getAlreadyReturnedQuantities(
  invoiceId: string
): Promise<Map<string, number>> {
  const rows = await sql<{ invoice_item_id: string; total_returned: number }[]>`
    SELECT ri.invoice_item_id, SUM(ri.quantity)::int AS total_returned
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    WHERE r.invoice_id = ${invoiceId}
      AND ri.invoice_item_id IS NOT NULL
    GROUP BY ri.invoice_item_id
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.invoice_item_id, row.total_returned);
  }
  return map;
}

// ── Installment credit helper ─────────────────────────────────

/**
 * Applies a return credit to the invoice's installments (latest first).
 *
 * For every installment processed:
 *   - amount_due  decreases by the return reduction
 *   - amount_paid is capped to the new amount_due (excess is collected)
 *   - amount_remaining = new_due - new_paid
 *
 * What happens with the excess (amount_paid that was capped):
 *   'credit'      → rolled forward to other unpaid invoices, remainder → credit_balance
 *   'cash_refund' → returned to the customer as cash (caller inserts wallet tx)
 *
 * Returns the actual cash amount to refund for 'cash_refund' (0 for 'credit').
 */
async function applyReturnCreditToInstallments(
  invoiceId: string,
  customerId: string,
  creditAmount: number,
  resolutionType: ReturnResolution,
  tx: postgres.TransactionSql
): Promise<{ cashToRefund: number }> {
  const installments = await tx<
    { id: string; amount_due: string; amount_paid: string }[]
  >`
    SELECT id, amount_due, amount_paid
    FROM installments
    WHERE invoice_id = ${invoiceId}
    ORDER BY installment_number DESC
  `;

  let remaining    = creditAmount;
  let totalExcess  = 0; // amount_paid that exceeded the new (lower) amount_due

  for (const inst of installments) {
    if (remaining <= 0) break;

    const currentDue  = Number(inst.amount_due);
    const currentPaid = Number(inst.amount_paid);

    const reduction = Math.min(remaining, currentDue);
    const newDue    = Number((currentDue - reduction).toFixed(2));

    // Cap paid to new obligation — any overpaid portion becomes excess
    const newPaid   = Number(Math.min(currentPaid, newDue).toFixed(2));
    totalExcess    += Number((currentPaid - newPaid).toFixed(2));

    const newRemaining = Number((newDue - newPaid).toFixed(2));
    const newStatus    =
      newRemaining === 0 ? 'paid'    :
      newPaid      >  0 ? 'partial'  :
                          'pending';

    await tx`
      UPDATE installments
      SET
        amount_due       = ${newDue.toFixed(2)},
        amount_paid      = ${newPaid.toFixed(2)},
        amount_remaining = ${newRemaining.toFixed(2)},
        status           = ${newStatus}::payment_status,
        updated_at       = NOW()
      WHERE id = ${inst.id}
    `;

    remaining = Number((remaining - reduction).toFixed(2));
  }

  // For cash_refund: excess goes back to the customer as cash.
  // The caller inserts the wallet transaction so only the real overpaid
  // amount (not the full return value) is ever refunded.
  if (resolutionType === 'cash_refund') {
    return { cashToRefund: Number(totalExcess.toFixed(2)) };
  }

  // For credit: roll totalExcess + any unabsorbed credit to other invoices,
  // then store the remainder in the customer's credit_balance.
  let toRoll = Number((totalExcess + remaining).toFixed(2));

  if (toRoll > 0) {
    const otherInstallments = await tx<
      { id: string; amount_paid: string; amount_remaining: string }[]
    >`
      SELECT i.id, i.amount_paid, i.amount_remaining
      FROM installments i
      JOIN invoices inv ON inv.id = i.invoice_id
      WHERE inv.customer_id  = ${customerId}
        AND i.invoice_id    != ${invoiceId}
        AND i.status        != 'paid'
        AND i.amount_remaining > 0
      ORDER BY i.due_date ASC NULLS LAST, i.created_at ASC
    `;

    for (const inst of otherInstallments) {
      if (toRoll <= 0) break;

      const instRemaining = Number(inst.amount_remaining);
      const allocated     = Math.min(toRoll, instRemaining);
      const newPaid       = Number((Number(inst.amount_paid) + allocated).toFixed(2));
      const newRem        = Number((instRemaining - allocated).toFixed(2));

      await tx`
        UPDATE installments
        SET
          amount_paid      = ${newPaid.toFixed(2)},
          amount_remaining = ${newRem.toFixed(2)},
          status = CASE
            WHEN ${newRem.toFixed(2)}::numeric = 0 THEN 'paid'::payment_status
            ELSE 'partial'::payment_status
          END,
          updated_at = NOW()
        WHERE id = ${inst.id}
      `;

      toRoll = Number((toRoll - allocated).toFixed(2));
    }

    if (toRoll > 0) {
      await tx`
        UPDATE customers
        SET credit_balance = credit_balance + ${toRoll.toFixed(2)}
        WHERE id = ${customerId}
      `;
    }
  }

  return { cashToRefund: 0 };
}

// ── Mutations ─────────────────────────────────────────────────

export async function createReturn(input: CreateReturnInput): Promise<ReturnWithItems> {
  const creditAmount = input.items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  if (creditAmount <= 0) {
    throw new Error("Return credit amount must be greater than zero.");
  }

  return await sql.begin(async (tx) => {
    // Resolve customer_id first (needed for installment logic)
    const [{ customer_id }] = await tx<{ customer_id: string }[]>`
      SELECT customer_id FROM invoices WHERE id = ${input.invoice_id}
    `;

    // Insert the return record.
    // Note: the wallet trigger (fn_return_sync_wallet) has been neutralized —
    // the actual cash refund amount is computed below and inserted manually.
    const [returnRecord] = await tx<Return[]>`
      INSERT INTO returns (invoice_id, created_by, credit_amount, resolution_type, reason, notes)
      VALUES (
        ${input.invoice_id},
        ${input.created_by},
        ${creditAmount.toFixed(2)},
        ${input.resolution_type},
        ${input.reason ?? null},
        ${input.notes ?? null}
      )
      RETURNING *
    `;

    // Insert return items and restore stock
    const returnItems: ReturnItem[] = [];
    for (const item of input.items) {
      const lineTotal = item.unit_price * item.quantity;

      const [returnItem] = await tx<ReturnItem[]>`
        INSERT INTO return_items (
          return_id, invoice_item_id, product_id,
          product_name, unit_price, quantity, line_total
        ) VALUES (
          ${returnRecord.id},
          ${item.invoice_item_id},
          ${item.product_id ?? null},
          ${item.product_name},
          ${item.unit_price.toFixed(2)},
          ${item.quantity},
          ${lineTotal.toFixed(2)}
        )
        RETURNING *
      `;
      returnItems.push(returnItem);

      if (item.product_id) {
        await tx`
          UPDATE products
          SET stock_quantity = stock_quantity + ${item.quantity},
              updated_at = NOW()
          WHERE id = ${item.product_id}
        `;
      }
    }

    // Update installments: amount_due drops by return value, amount_paid is
    // capped to new_due (excess is the actual overpaid cash or credit to roll).
    const { cashToRefund } = await applyReturnCreditToInstallments(
      input.invoice_id, customer_id, creditAmount, input.resolution_type, tx
    );

    // For cash_refund: only refund what was genuinely overpaid (not the full
    // return value) — this is the amount amount_paid was reduced by.
    if (input.resolution_type === 'cash_refund' && cashToRefund > 0) {
      await tx`
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id)
        VALUES ('EGP', ${cashToRefund.toFixed(2)}, 'out', 'customer_refund', ${returnRecord.id})
      `;
      await tx`
        UPDATE company_wallet
        SET egp_balance = egp_balance - ${cashToRefund.toFixed(2)},
            updated_at  = NOW()
      `;
    }

    return { ...returnRecord, items: returnItems };
  });
}

// ── Server Action ─────────────────────────────────────────────

const ReturnSchema = z.object({
  resolution_type: z.enum(['credit', 'cash_refund'], {
    invalid_type_error: 'Please select a resolution type.',
  }),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function createReturnAction(
  invoiceId: string,
  _prevState: ReturnState,
  formData: FormData
): Promise<ReturnState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { errors: { general: ['You must be signed in.'] }, message: null };
  }

  // Parse items from form
  let items: CreateReturnItemInput[] = [];
  try {
    items = JSON.parse(formData.get('items') as string ?? '[]');
  } catch {
    return { errors: { items: ['Invalid return items data.'] }, message: 'Failed to create return.' };
  }

  items = items.filter((i) => i.quantity > 0);

  if (items.length === 0) {
    return {
      errors: { items: ['Please select at least one item to return with quantity > 0.'] },
      message: 'Validation failed.',
    };
  }

  const validated = ReturnSchema.safeParse({
    resolution_type: formData.get('resolution_type'),
    reason: formData.get('reason') ?? undefined,
    notes: formData.get('notes') ?? undefined,
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, message: 'Validation failed.' };
  }

  // Validate return quantities against original invoice
  const [invoice, alreadyReturned] = await Promise.all([
    getInvoiceById(invoiceId),
    getAlreadyReturnedQuantities(invoiceId),
  ]);
  if (!invoice) {
    return { errors: { general: ['Invoice not found.'] }, message: null };
  }

  const originalMap = new Map(invoice.items.map((i) => [i.id, Number(i.quantity)]));

  for (const item of items) {
    const originalQty   = originalMap.get(item.invoice_item_id) ?? 0;
    const prevReturned  = alreadyReturned.get(item.invoice_item_id) ?? 0;
    const maxReturnable = originalQty - prevReturned;

    if (item.quantity > maxReturnable) {
      return {
        errors: {
          items: [`"${item.product_name}": cannot return ${item.quantity} — only ${maxReturnable} returnable.`],
        },
        message: 'Validation failed.',
      };
    }
  }

  // For cash_refund: verify the customer has actually overpaid after this return.
  // Cash refund = amount_paid capped to new_due. If nothing was overpaid, reject.
  if (validated.data.resolution_type === 'cash_refund') {
    const creditAmount = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);

    const [totals] = await sql<{ total_due: string; total_paid: string }[]>`
      SELECT
        COALESCE(SUM(amount_due),  0)::text AS total_due,
        COALESCE(SUM(amount_paid), 0)::text AS total_paid
      FROM installments
      WHERE invoice_id = ${invoiceId}
    `;
    const newDue   = Number(totals.total_due) - creditAmount;
    const overpaid = Math.max(0, Number(totals.total_paid) - newDue);

    if (overpaid === 0) {
      return {
        errors: {
          resolution_type: [
            'Cash refund is not available — the customer has not overpaid this invoice. Use "Apply as credit" to reduce the outstanding balance instead.',
          ],
        },
        message: 'Validation failed.',
      };
    }
  }

  await createReturn({
    invoice_id:      invoiceId,
    created_by:      session.user.id,
    resolution_type: validated.data.resolution_type,
    items,
    reason: validated.data.reason,
    notes:  validated.data.notes,
  });

  revalidatePath(`/dashboard/invoices/${invoiceId}/edit`);
  revalidatePath('/dashboard/invoices');
  redirect(`/dashboard/invoices/${invoiceId}/edit`);
}
