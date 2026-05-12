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

export interface UpdatePaymentInput {
  amount?: number;
  payment_method?: PaymentMethod;
  allocations?: PaymentAllocationInput[]; // required if amount changes
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
    SELECT * FROM payments WHERE id = ${id}
  `;
  if (!payment) return null;

  const allocations = await sql<PaymentInstallment[]>`
    SELECT * FROM payment_installments WHERE payment_id = ${id}
  `;

  return { ...payment, allocations };
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Records a payment and allocates it across one or more installments.
 * Validations enforced:
 *  - sum(allocations.amount_allocated) must equal payment.amount
 *  - each allocation cannot exceed the installment's amount_remaining
 *
 * DB trigger (trg_payment_sync_wallet) fires on INSERT and automatically:
 *  - writes a wallet_transaction (EGP in)
 *  - increments company_wallet.egp_balance
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
    // 1. Insert payment — triggers wallet sync automatically
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
          UPDATE installments SET
            amount_paid      = amount_paid + ${alloc.amount_allocated},
            amount_remaining = amount_remaining - ${alloc.amount_allocated}
          WHERE id = ${alloc.installment_id}
        `;

        return row;
      })
    );

    return { ...payment, allocations };
  });
}

/**
 * Updates a payment. Handles two cases:
 *
 * AMOUNT UNCHANGED — only non-financial fields changed (method, reference,
 * notes, paid_at). Updates the payment row directly. No wallet entries added.
 *
 * AMOUNT CHANGED — performs a wallet reversal:
 *   1. Reverses installment allocations from the old payment
 *   2. Deletes the old payment row        → trigger writes wallet 'out' reversal
 *   3. Inserts a new payment row          → trigger writes wallet 'in' correction
 *   4. Applies new allocations
 *
 * The wallet ledger ends up with three entries for the correction:
 *   original 'in' (old amount) | reversal 'out' (old amount) | correction 'in' (new amount)
 *
 * Requires allocations in input when amount changes.
 */
export async function updatePayment(
  id: string,
  input: UpdatePaymentInput
): Promise<PaymentWithAllocations> {
  const existing = await getPaymentById(id);
  if (!existing) throw new Error(`Payment ${id} not found`);

  const amountChanged =
    input.amount !== undefined &&
    Math.abs(input.amount - Number(existing.amount)) > 0.001;

  // ── Case 1: non-financial update only ────────────────────────
  if (!amountChanged) {
    const [updated] = await sql<Payment[]>`
      UPDATE payments SET
        payment_method = COALESCE(${input.payment_method ?? null}::payment_method, payment_method),
        reference      = COALESCE(${input.reference ?? null}, reference),
        notes          = COALESCE(${input.notes     ?? null}, notes),
        paid_at        = COALESCE(${input.paid_at   ?? null}, paid_at)
      WHERE id = ${id}
      RETURNING *
    `;

    const allocations = await sql<PaymentInstallment[]>`
      SELECT * FROM payment_installments WHERE payment_id = ${id}
    `;

    return { ...updated, allocations };
  }

  // ── Case 2: amount changed — reversal + re-create ─────────────
  if (!input.allocations || input.allocations.length === 0) {
    throw new Error("allocations are required when updating payment amount");
  }

  const newAmount = input.amount!;
  const allocationTotal = input.allocations.reduce(
    (sum, a) => sum + a.amount_allocated,
    0
  );
  if (Math.abs(allocationTotal - newAmount) > 0.001) {
    throw new Error(
      `Allocation total (${allocationTotal}) must equal new payment amount (${newAmount})`
    );
  }

  return await sql.begin(async (tx) => {
    // Step 1 — reverse existing installment allocations
    await Promise.all(
      existing.allocations.map((alloc) =>
        tx`
          UPDATE installments SET
            amount_paid      = amount_paid      - ${alloc.amount_allocated},
            amount_remaining = amount_remaining + ${alloc.amount_allocated},
            status = CASE
              WHEN amount_paid - ${alloc.amount_allocated} = 0 THEN 'pending'::payment_status
              ELSE 'partial'::payment_status
            END
          WHERE id = ${alloc.installment_id}
        `
      )
    );

    // Step 2 — find the original wallet_transaction for this payment
    // so we can link the reversal via corrects_id
    const [originalTx] = await tx<{ id: string }[]>`
      SELECT id FROM wallet_transactions
      WHERE reference_id = ${id}
        AND direction    = 'in'
        AND reason       = 'invoice_payment'
      ORDER BY created_at ASC
      LIMIT 1
    `;

    // Step 3 — delete old payment row
    // DB trigger writes a wallet 'out' entry (reversal) automatically.
    // We then update that reversal row to set corrects_id → originalTx.id
    await tx`DELETE FROM payments WHERE id = ${id}`;

    if (originalTx) {
      await tx`
        UPDATE wallet_transactions
        SET corrects_id = ${originalTx.id}
        WHERE reference_id = ${id}
          AND direction    = 'out'
          AND reason       = 'invoice_payment'
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }

    // Step 4 — insert corrected payment row
    // DB trigger writes a wallet 'in' entry (correction) automatically.
    const [newPayment] = await tx<Payment[]>`
      INSERT INTO payments (
        invoice_id, amount, payment_method,
        reference, notes, paid_at
      ) VALUES (
        ${existing.invoice_id},
        ${newAmount},
        ${(input.payment_method ?? existing.payment_method)   }::payment_method,
        ${input.reference ?? existing.reference},
        ${input.notes     ?? existing.notes},
        ${input.paid_at   ?? existing.paid_at}
      )
      RETURNING *
    `;

    // Link the new wallet 'in' entry to the reversal row via corrects_id
    if (originalTx) {
      // Find the reversal row we just created
      const [reversalTx] = await tx<{ id: string }[]>`
        SELECT id FROM wallet_transactions
        WHERE reference_id = ${id}
          AND direction    = 'out'
          AND reason       = 'invoice_payment'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (reversalTx) {
        await tx`
          UPDATE wallet_transactions
          SET corrects_id = ${reversalTx.id}
          WHERE reference_id = ${newPayment.id}
            AND direction    = 'in'
            AND reason       = 'invoice_payment'
          ORDER BY created_at DESC
          LIMIT 1
        `;
      }
    }

    // Step 5 — apply new allocations
    const allocations = await Promise.all(
      input.allocations!.map(async (alloc) => {
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
            `Allocation (${alloc.amount_allocated}) exceeds remaining (${installment.amount_remaining}) for installment ${alloc.installment_id}`
          );
        }

        const [row] = await tx<PaymentInstallment[]>`
          INSERT INTO payment_installments (payment_id, installment_id, amount_allocated)
          VALUES (${newPayment.id}, ${alloc.installment_id}, ${alloc.amount_allocated})
          RETURNING *
        `;

        await tx`
          UPDATE installments SET
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

    return { ...newPayment, allocations };
  });
}

/**
 * Deletes a payment and reverses all installment allocations.
 * DB trigger fires on DELETE and automatically:
 *  - writes a wallet_transaction (EGP out — reversal)
 *  - decrements company_wallet.egp_balance
 */
export async function deletePayment(id: string): Promise<boolean> {
  return await sql.begin(async (tx) => {
    // Fetch allocations before deleting
    const allocations = await tx<PaymentInstallment[]>`
      SELECT * FROM payment_installments WHERE payment_id = ${id}
    `;

    // Reverse each installment's balance
    await Promise.all(
      allocations.map((alloc) =>
        tx`
          UPDATE installments SET
            amount_paid      = amount_paid      - ${alloc.amount_allocated},
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
    const result = await tx`DELETE FROM payments WHERE id = ${id}`;
    return result.count > 0;
  });
}
