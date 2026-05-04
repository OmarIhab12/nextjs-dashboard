import postgres from "postgres";
import sql from "../db";

export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";

export interface Installment {
  id: string;
  invoice_id: string;
  installment_number: number;
  amount_due: string;
  amount_paid: string;
  amount_remaining: string;
  due_date: Date | null;
  status: PaymentStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInstallmentInput {
  invoice_id: string;
  installment_number: number;
  amount_due: number;
  due_date?: Date;
  notes?: string;
}

export interface UpdateInstallmentInput {
  amount_due?: number;
  due_date?: Date | null;
  notes?: string | null;
  status?: PaymentStatus;
}

// ── Queries ──────────────────────────────────────────────────

export async function getInstallmentsByInvoice(
  invoiceId: string
): Promise<Installment[]> {
  return sql<Installment[]>`
    SELECT * FROM installments
    WHERE invoice_id = ${invoiceId}
    ORDER BY installment_number ASC
  `;
}

export async function getInstallmentById(
  id: string
): Promise<Installment | null> {
  const [installment] = await sql<Installment[]>`
    SELECT * FROM installments
    WHERE id = ${id}
  `;
  return installment ?? null;
}

export async function getOverdueInstallments(): Promise<Installment[]> {
  return sql<Installment[]>`
    SELECT * FROM installments
    WHERE due_date < CURRENT_DATE
      AND status NOT IN ('paid')
    ORDER BY due_date ASC
  `;
}

// ── Validation ───────────────────────────────────────────────

export async function isInstallmentsBalanced(
  invoiceId: string
): Promise<boolean> {
  const [{ installments_balanced }] = await sql<
    { installments_balanced: boolean }[]
  >`SELECT installments_balanced(${invoiceId})`;
  return installments_balanced;
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Adds a new installment to an invoice.
 * The caller must ensure the sum of all amount_due values
 * still equals the invoice total after adding this one.
 */
export async function createInstallment(
  input: CreateInstallmentInput
): Promise<Installment> {
  const [installment] = await sql<Installment[]>`
    INSERT INTO installments (
      invoice_id, installment_number,
      amount_due, amount_paid, amount_remaining,
      due_date, status, notes
    ) VALUES (
      ${input.invoice_id},
      ${input.installment_number},
      ${input.amount_due},
      0,
      ${input.amount_due},
      ${input.due_date ?? null},
      'pending',
      ${input.notes    ?? null}
    )
    RETURNING *
  `;
  return installment;
}

/**
 * Splits one installment into two.
 * firstAmount + secondAmount must equal the original amount_due.
 * Only valid if no payments have been made against this installment.
 */
export async function splitInstallment(
  id: string,
  firstAmount: number,
  secondDueDate?: Date
): Promise<Installment[]> {
  return await sql.begin(async (tx) => {
    const [original] = await tx<Installment[]>`
      SELECT * FROM installments WHERE id = ${id}
    `;
    if (!original) throw new Error("Installment not found");
    if (Number(original.amount_paid) > 0) {
      throw new Error("Cannot split a partially or fully paid installment");
    }

    const secondAmount = Number(original.amount_due) - firstAmount;
    if (secondAmount <= 0) {
      throw new Error("First amount must be less than the total amount due");
    }

    // Update original with new (smaller) amount
    const [updated] = await tx<Installment[]>`
      UPDATE installments
      SET amount_due = ${firstAmount}, amount_remaining = ${firstAmount}
      WHERE id = ${id}
      RETURNING *
    `;

    // Shift all subsequent installment numbers up by 1
    await tx`
      UPDATE installments
      SET installment_number = installment_number + 1
      WHERE invoice_id = ${original.invoice_id}
        AND installment_number > ${original.installment_number}
    `;

    // Insert new installment after the original
    const [newInstallment] = await tx<Installment[]>`
      INSERT INTO installments (
        invoice_id, installment_number,
        amount_due, amount_paid, amount_remaining,
        due_date, status
      ) VALUES (
        ${original.invoice_id},
        ${original.installment_number + 1},
        ${secondAmount},
        0,
        ${secondAmount},
        ${secondDueDate ?? null},
        'pending'
      )
      RETURNING *
    `;

    return [updated, newInstallment];
  });
}

export async function updateInstallment(
  id: string,
  input: UpdateInstallmentInput
): Promise<Installment | null> {
  const [installment] = await sql<Installment[]>`
    UPDATE installments
    SET
      amount_due       = COALESCE(${input.amount_due  ?? null}, amount_due),
      amount_remaining = CASE
        WHEN ${input.amount_due ?? null} IS NOT NULL
        THEN ${input.amount_due ?? null} - amount_paid
        ELSE amount_remaining
      END,
      due_date = COALESCE(${input.due_date !== undefined ? input.due_date : null}, due_date),
      notes    = COALESCE(${input.notes    !== undefined ? input.notes    : null}, notes),
      status   = COALESCE(${input.status   ?? null}::installment_status, status)
    WHERE id = ${id}
    RETURNING *
  `;
  return installment ?? null;
}

export async function deleteInstallment(id: string): Promise<boolean> {
  // Only unpaid installments with no payment allocations can be deleted
  const result = await sql`
    DELETE FROM installments
    WHERE id = ${id}
      AND amount_paid = 0
      AND NOT EXISTS (
        SELECT 1 FROM payment_installments WHERE installment_id = ${id}
      )
  `;
  return result.count > 0;
}

export async function syncInstallmentWithInvoice(
  invoiceId: string,
  newTotal: number,
  customerId: string,
  tx: postgres.TransactionSql
): Promise<void> {
  
    // Get the invoice's installment
    const [installment] = await tx`
      SELECT * FROM installments
      WHERE invoice_id = ${invoiceId}
      ORDER BY installment_number ASC
      LIMIT 1
    `;

    if (!installment) return;

    const amountPaid = Number(installment.amount_paid);
    const newRemaining = Number((newTotal - amountPaid).toFixed(2));

    console.log(amountPaid.toFixed(2));
    console.log(newRemaining.toFixed(2));

    if (newRemaining >= 0) {
      // Normal case — update amount_due and amount_remaining
      await tx`
        UPDATE installments
        SET
          amount_due       = ${newTotal.toFixed(2)},
          amount_remaining = ${newRemaining.toFixed(2)},
          status = CASE
            WHEN ${newRemaining.toFixed(2)} = 0.00 THEN 'paid'::payment_status
            WHEN ${amountPaid.toFixed(2)} > 0.00   THEN 'partial'::payment_status
            ELSE 'pending'::payment_status
          END
        WHERE id = ${installment.id}
      `;
    } else {
      // Overpaid case — amount_paid exceeds new total
      // Set this installment to fully paid
      const excess = Number((amountPaid - newTotal).toFixed(2));

      await tx`
        UPDATE installments
        SET
          amount_due       = ${newTotal.toFixed(2)},
          amount_paid      = ${newTotal.toFixed(2)},
          amount_remaining = 0,
          status           = 'paid'::payment_status
        WHERE id = ${installment.id}
      `;

      // Roll excess forward to oldest unpaid installment
      // of the same customer (excluding this invoice)
      const nextInstallments = await tx`
        SELECT i.*
        FROM installments i
        JOIN invoices inv ON inv.id = i.invoice_id
        WHERE inv.customer_id = ${customerId}
          AND i.invoice_id    != ${invoiceId}
          AND i.status        != 'paid'
          AND i.amount_remaining > 0
        ORDER BY i.due_date ASC NULLS LAST, i.created_at ASC
      `;

      let remaining = excess;

      for (const inst of nextInstallments) {
        if (remaining <= 0) break;

        const allocated  = Math.min(remaining, Number(inst.amount_remaining));
        remaining        = Number((remaining - allocated).toFixed(2));
        const newPaid    = Number((Number(inst.amount_paid) + allocated).toFixed(2));
        const newRem     = Number((Number(inst.amount_remaining) - allocated).toFixed(2));

        await tx`
          UPDATE installments
          SET
            amount_paid      = ${newPaid.toFixed(2)},
            amount_remaining = ${newRem.toFixed(2)},
            status = CASE
              WHEN ${newRem.toFixed(2)} = 0 THEN 'paid'::payment_status
              ELSE 'partial'::payment_status
            END
          WHERE id = ${inst.id}
        `;
      }
    };
}
