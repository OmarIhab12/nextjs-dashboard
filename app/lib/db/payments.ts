import sql from "../db";

export type PaymentMethod = "bank_transfer" | "cash" | "card" | "check" | "other";

export interface Payment {
  id: string;
  invoice_id: string;
  amount: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paid_at: Date;
  created_at: Date;
}

export interface PaymentInstallment {
  id: string;
  payment_id: string;
  installment_id: string;
  amount_allocated: string;
}

export interface PaymentAllocationInput {
  installment_id: string;
  amount_allocated: number;
}

export interface CreatePaymentInput {
  invoice_id: string;
  amount: number;
  payment_method: PaymentMethod;
  allocations: PaymentAllocationInput[]; // must sum to amount
  reference?: string;
  notes?: string;
  paid_at?: Date;
}

export interface PaymentWithAllocations extends Payment {
  allocations: PaymentInstallment[];
}

// ── Queries ──────────────────────────────────────────────────

export async function getPaymentsByInvoice(
  invoiceId: string
): Promise<Payment[]> {
  return sql<Payment[]>`
    SELECT * FROM payments
    WHERE invoice_id = ${invoiceId}
    ORDER BY paid_at DESC
  `;
}

export async function getPaymentById(
  id: string
): Promise<PaymentWithAllocations | null> {
  const [payment] = await sql<Payment[]>`
    SELECT * FROM payments
    WHERE id = ${id}
  `;
  if (!payment) return null;

  const allocations = await sql<PaymentInstallment[]>`
    SELECT * FROM payment_installments
    WHERE payment_id = ${id}
  `;

  return { ...payment, allocations };
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Records a payment and allocates it across one or more installments.
 * Validations enforced:
 *  - sum(allocations.amount_allocated) must equal payment.amount
 *  - each allocation cannot exceed the installment's amount_remaining
 */
export async function createPayment(
  input: CreatePaymentInput
): Promise<PaymentWithAllocations> {
  // Validate allocation sum matches payment amount
  const allocationTotal = input.allocations.reduce(
    (sum, a) => sum + a.amount_allocated,
    0
  );
  if (Math.abs(allocationTotal - input.amount) > 0.001) {
    throw new Error(
      `Allocation total (${allocationTotal}) must equal payment amount (${input.amount})`
    );
  }

  return await sql.begin(async (tx) => {
    // 1. Insert payment
    const [payment] = await tx<Payment[]>`
      INSERT INTO payments (
        invoice_id, amount, payment_method,
        reference, notes, paid_at
      ) VALUES (
        ${input.invoice_id},
        ${input.amount},
        ${input.payment_method}::payment_method,
        ${input.reference ?? null},
        ${input.notes     ?? null},
        ${input.paid_at   ?? new Date()}
      )
      RETURNING *
    `;

    // 2. Insert allocations and update each installment
    const allocations = await Promise.all(
      input.allocations.map(async (alloc) => {
        // Lock the installment row and validate remaining amount
        const [installment] = await tx`
          SELECT amount_remaining FROM installments
          WHERE id = ${alloc.installment_id}
          FOR UPDATE
        `;
        if (!installment) {
          throw new Error(`Installment ${alloc.installment_id} not found`);
        }
        if (alloc.amount_allocated > Number(installment.amount_remaining)) {
          throw new Error(
            `Allocation (${alloc.amount_allocated}) exceeds remaining amount (${installment.amount_remaining}) for installment ${alloc.installment_id}`
          );
        }

        // Insert allocation row
        const [row] = await tx<PaymentInstallment[]>`
          INSERT INTO payment_installments (payment_id, installment_id, amount_allocated)
          VALUES (${payment.id}, ${alloc.installment_id}, ${alloc.amount_allocated})
          RETURNING *
        `;

        // Update installment balances and status
        await tx`
          UPDATE installments
          SET
            amount_paid      = amount_paid + ${alloc.amount_allocated},
            amount_remaining = amount_remaining - ${alloc.amount_allocated},
            status = CASE
              WHEN amount_remaining - ${alloc.amount_allocated} = 0 THEN 'paid'::payment_status
              WHEN amount_paid + ${alloc.amount_allocated} > 0      THEN 'partial'::payment_status
              ELSE status
            END
          WHERE id = ${alloc.installment_id}
        `;

        return row;
      })
    );

    // // 3. Recalculate invoice status based on all installments
    // await tx`
    //   UPDATE invoices
    //   SET status = CASE
    //     WHEN NOT EXISTS (
    //       SELECT 1 FROM installments
    //       WHERE invoice_id = ${input.invoice_id}
    //         AND status != 'paid'
    //     ) THEN 'paid'::invoice_status
    //     WHEN EXISTS (
    //       SELECT 1 FROM installments
    //       WHERE invoice_id = ${input.invoice_id}
    //         AND status = 'partial'
    //     ) THEN 'sent'::invoice_status
    //     ELSE status
    //   END
    //   WHERE id = ${input.invoice_id}
    // `;

    return { ...payment, allocations };
  });
}

export async function deletePayment(id: string): Promise<boolean> {
  return await sql.begin(async (tx) => {
    // Fetch allocations before deleting
    const allocations = await tx<PaymentInstallment[]>`
      SELECT * FROM payment_installments
      WHERE payment_id = ${id}
    `;

    // Reverse each installment's balance
    await Promise.all(
      allocations.map((alloc) =>
        tx`
          UPDATE installments
          SET
            amount_paid      = amount_paid - ${alloc.amount_allocated},
            amount_remaining = amount_remaining + ${alloc.amount_allocated},
            status = CASE
              WHEN amount_paid - ${alloc.amount_allocated} = 0 THEN 'pending'::payment_status
              ELSE 'partial'::payment_status
            END
          WHERE id = ${alloc.installment_id}
        `
      )
    );

    // Delete payment (payment_installments cascade)
    const result = await tx`
      DELETE FROM payments WHERE id = ${id}
    `;

    return result.count > 0;
  });
}
