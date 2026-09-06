import sql from "../db";

export type PaymentMethod = "bank_transfer" | "cash" | "check" | "vodafone_cash";

export interface Payment {
  id: string;
  invoice_id: string | null;
  customer_id: string | null; // set instead of invoice_id when the payment has no invoice to apply to (pure credit)
  amount: string;
  payment_method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  paid_at: Date;
  created_at: Date;
  created_by: string;
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
  created_by: string;
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
        reference, notes, paid_at, created_by
      ) VALUES (
        ${input.invoice_id},
        ${input.amount},
        ${input.payment_method}::payment_method,
        ${input.reference  ?? null},
        ${input.notes      ?? null},
        ${input.paid_at    ?? new Date()},
        ${input.created_by}
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
      // (reference_id, direction, reason) already uniquely identifies the one
      // reversal row the DELETE trigger above just wrote for this payment —
      // Postgres UPDATE doesn't support ORDER BY/LIMIT anyway.
      await tx`
        UPDATE wallet_transactions
        SET corrects_id = ${originalTx.id}
        WHERE reference_id = ${id}
          AND direction    = 'out'
          AND reason       = 'invoice_payment'
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
        // (reference_id, direction, reason) already uniquely identifies the
        // newly-inserted payment's 'in' row — no ORDER BY/LIMIT needed.
        await tx`
          UPDATE wallet_transactions
          SET corrects_id = ${reversalTx.id}
          WHERE reference_id = ${newPayment.id}
            AND direction    = 'in'
            AND reason       = 'invoice_payment'
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
 * A trigger has no access to the app's logged-in user, so it inserts that
 * reversal row with a placeholder created_by (OLD.created_by — the original
 * payment's creator). We immediately overwrite it with `deletedBy` (the user
 * actually performing the delete) and link corrects_id back to the original
 * 'in' entry (same pattern as updatePayment's amount-change path), so it
 * shows as a chained correction attributed to the right person.
 *
 * Also reverses any leftover amount that addPaymentForCustomer() credited to
 * customers.credit_balance at creation time (payment.amount minus what was
 * actually allocated to installments). If that credit has since been spent
 * (applied to a new invoice, or paid out via refundCustomerCredit), this
 * throws instead of driving the balance negative — the caller must resolve
 * that manually before the payment can be deleted.
 */
export async function deletePayment(id: string, deletedBy: string): Promise<boolean> {
  return await sql.begin(async (tx) => {
    // Fetch the payment itself — needed to find the customer for any
    // unallocated "excess" credited to their balance, and to know the
    // original amount vs. what was actually allocated.
    const [payment] = await tx<Payment[]>`
      SELECT * FROM payments WHERE id = ${id}
    `;
    if (!payment) return false;

    // Find the original wallet 'in' entry for this payment so the reversal
    // row the DELETE trigger is about to write can be chained to it.
    const [originalTx] = await tx<{ id: string }[]>`
      SELECT id FROM wallet_transactions
      WHERE reference_id = ${id}
        AND direction    = 'in'
        AND reason       = 'invoice_payment'
      ORDER BY created_at ASC
      LIMIT 1
    `;

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

    // Reverse any leftover credited to the customer's credit_balance.
    const allocatedTotal = allocations.reduce(
      (sum, a) => sum + Number(a.amount_allocated),
      0
    );
    const creditedLeftover = Number(
      (Number(payment.amount) - allocatedTotal).toFixed(2)
    );

    if (creditedLeftover > 0.001) {
      let customerId = payment.customer_id;
      if (!customerId && payment.invoice_id) {
        const [invoice] = await tx<{ customer_id: string }[]>`
          SELECT customer_id FROM invoices WHERE id = ${payment.invoice_id}
        `;
        customerId = invoice?.customer_id ?? null;
      }

      if (customerId) {
        const [updated] = await tx<{ credit_balance: string }[]>`
          UPDATE customers
          SET credit_balance = credit_balance - ${creditedLeftover.toFixed(2)}
          WHERE id = ${customerId} AND credit_balance >= ${creditedLeftover.toFixed(2)}
          RETURNING credit_balance
        `;
        if (!updated) {
          throw new Error(
            `Cannot delete payment ${id}: its E£${creditedLeftover.toFixed(2)} credit balance ` +
            `has already been spent by customer ${customerId}.`
          );
        }
      }
    }

    // Delete payment (payment_installments cascade).
    // DB trigger writes the reversal wallet_transaction ('out') as a side effect.
    const result = await tx`DELETE FROM payments WHERE id = ${id}`;

    // Attribute the reversal to the user actually performing the delete, and
    // chain it back to the original 'in' entry it undoes.
    // (reference_id, direction, reason) already uniquely identifies the one
    // reversal row the trigger above just wrote for this payment — no
    // ORDER BY/LIMIT needed (and Postgres UPDATE doesn't support them anyway).
    await tx`
      UPDATE wallet_transactions
      SET created_by  = ${deletedBy},
          corrects_id = ${originalTx?.id ?? null}
      WHERE reference_id = ${id}
        AND direction    = 'out'
        AND reason       = 'invoice_payment'
    `;

    return result.count > 0;
  });
}
