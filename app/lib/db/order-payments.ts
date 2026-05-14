// app/lib/db/order-payments.ts
// Mirrors the invoice payments pattern for supplier order payments (USD).

import sql from "@/app/lib/db";
// import { syncOrderInstalmentStatuses } from "./orders";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderPayment = {
  id:             string;
  order_id:       string;
  amount_usd:     string;
  payment_method: string;
  reference:      string | null;
  notes:          string | null;
  paid_at:        string;
  created_at:     string;
};

export type OrderPaymentAllocation = {
  instalment_id:    string;
  amount_allocated: number;
};

export type CreateOrderPaymentInput = {
  order_id:       string;
  amount_usd:     number;
  payment_method: "bank_transfer" | "cash" | "card" | "check" | "vodafone_cash" | "other";
  reference?:     string;
  notes?:         string;
  paid_at?:       Date;
  allocations:    OrderPaymentAllocation[];
};

export type UpdateOrderPaymentInput = {
  amount_usd?:     number;
  payment_method?: "bank_transfer" | "cash" | "card" | "check" | "vodafone_cash" | "other";
  allocations?:    OrderPaymentAllocation[]; // required if amount_usd changes
  reference?:      string;
  notes?:          string;
  paid_at?:        Date;
};

export type OrderPaymentWithAllocations = OrderPayment & {
  allocations: { instalment_id: string; amount_allocated: string }[];
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getPaymentsByOrder(orderId: string): Promise<OrderPayment[]> {
  return sql<OrderPayment[]>`
    SELECT * FROM order_payments
    WHERE order_id = ${orderId}
    ORDER BY paid_at DESC
  `;
}

export async function getOrderPaymentById(id: string): Promise<OrderPaymentWithAllocations | null> {
  const [payment] = await sql<OrderPayment[]>`
    SELECT * FROM order_payments WHERE id = ${id}
  `;
  if (!payment) return null;

  const allocations = await sql<{ instalment_id: string; amount_allocated: string }[]>`
    SELECT instalment_id, amount_allocated
    FROM order_payment_instalments
    WHERE order_payment_id = ${id}
  `;

  return { ...payment, allocations };
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Records a payment to a supplier and allocates it to instalments.
 * DB trigger (trg_order_payment_sync_wallet) fires on INSERT and automatically:
 *  - writes a wallet_transaction (USD out)
 *  - decrements company_wallet.usd_balance
 *  - updates orders.paid_usd and orders.status
 */
export async function createOrderPayment(
  input: CreateOrderPaymentInput,
): Promise<OrderPaymentWithAllocations> {
  const allocationTotal = input.allocations.reduce(
    (sum, a) => sum + a.amount_allocated, 0
  );
  if (Math.abs(allocationTotal - input.amount_usd) > 0.001) {
    throw new Error(
      `Allocation total (${allocationTotal}) must equal payment amount (${input.amount_usd})`
    );
  }

  return await sql.begin(async (tx) => {
    // 1. Insert payment — DB trigger handles wallet & order.paid_usd
    const [payment] = await tx<OrderPayment[]>`
      INSERT INTO order_payments (order_id, amount_usd, payment_method, reference, notes, paid_at)
      VALUES (
        ${input.order_id},
        ${input.amount_usd.toFixed(2)}::numeric,
        ${input.payment_method}::payment_method,
        ${input.reference ?? null},
        ${input.notes     ?? null},
        ${input.paid_at   ?? new Date()}
      )
      RETURNING *
    `;

    // 2. Allocate to instalments
    const allocations = await Promise.all(
      input.allocations.map(async (alloc) => {
        const [instalment] = await tx`
          SELECT amount_remaining FROM order_instalments
          WHERE id = ${alloc.instalment_id}
          FOR UPDATE
        `;
        if (!instalment) throw new Error(`Instalment ${alloc.instalment_id} not found`);
        if (alloc.amount_allocated > Number(instalment.amount_remaining)) {
          throw new Error(
            `Allocation (${alloc.amount_allocated}) exceeds remaining (${instalment.amount_remaining})`
          );
        }

        await tx`
          INSERT INTO order_payment_instalments (order_payment_id, instalment_id, amount_allocated)
          VALUES (${payment.id}, ${alloc.instalment_id}, ${alloc.amount_allocated.toFixed(2)}::numeric)
        `;

        await tx`
          UPDATE order_instalments SET
            amount_paid      = amount_paid + ${alloc.amount_allocated.toFixed(2)}::numeric,
            amount_remaining = amount_due  - (amount_paid + ${alloc.amount_allocated.toFixed(2)}::numeric)
          WHERE id = ${alloc.instalment_id}
        `;

        return { instalment_id: alloc.instalment_id, amount_allocated: String(alloc.amount_allocated) };
      })
    );

    // await syncOrderInstalmentStatuses(input.order_id);

    return { ...payment, allocations };
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Updates an order payment. Handles two cases:
 *
 * AMOUNT UNCHANGED — updates non-financial fields only (method, reference,
 * notes, paid_at). No wallet entries written.
 *
 * AMOUNT CHANGED — performs a wallet reversal:
 *   1. Reverses instalment allocations from the old payment
 *   2. Deletes old payment row      → trigger writes wallet USD 'in' (reversal)
 *                                     and reverses order.paid_usd
 *   3. Inserts new payment row      → trigger writes wallet USD 'out' (correction)
 *                                     and updates order.paid_usd
 *   4. Applies new allocations
 *   5. Links corrects_id chain on wallet_transactions
 *
 * Requires allocations when amount_usd changes.
 */
export async function updateOrderPayment(
  id:    string,
  input: UpdateOrderPaymentInput,
): Promise<OrderPaymentWithAllocations> {
  const existing = await getOrderPaymentById(id);
  if (!existing) throw new Error(`Order payment ${id} not found`);

  const amountChanged =
    input.amount_usd !== undefined &&
    Math.abs(input.amount_usd - Number(existing.amount_usd)) > 0.001;

  // ── Case 1: non-financial update only ────────────────────────
  if (!amountChanged) {
    const [updated] = await sql<OrderPayment[]>`
      UPDATE order_payments SET
        payment_method = COALESCE(${input.payment_method ?? null}::payment_method, payment_method),
        reference      = COALESCE(${input.reference ?? null}, reference),
        notes          = COALESCE(${input.notes     ?? null}, notes),
        paid_at        = COALESCE(${input.paid_at   ?? null}, paid_at)
      WHERE id = ${id}
      RETURNING *
    `;
    return { ...updated, allocations: existing.allocations };
  }

  // ── Case 2: amount changed — reversal + re-create ─────────────
  if (!input.allocations || input.allocations.length === 0) {
    throw new Error("allocations are required when updating payment amount");
  }

  const newAmount = input.amount_usd!;
  const allocationTotal = input.allocations.reduce(
    (sum, a) => sum + a.amount_allocated, 0
  );
  if (Math.abs(allocationTotal - newAmount) > 0.001) {
    throw new Error(
      `Allocation total (${allocationTotal}) must equal new payment amount (${newAmount})`
    );
  }

  return await sql.begin(async (tx) => {
    // Step 1 — reverse existing instalment allocations
    await Promise.all(
      existing.allocations.map((alloc) =>
        tx`
          UPDATE order_instalments SET
            amount_paid      = GREATEST(0, amount_paid - ${alloc.amount_allocated}::numeric),
            amount_remaining = amount_due - GREATEST(0, amount_paid - ${alloc.amount_allocated}::numeric)
          WHERE id = ${alloc.instalment_id}
        `
      )
    );

    // Step 2 — find original wallet_transaction to build corrects_id chain
    const [originalTx] = await tx<{ id: string }[]>`
      SELECT id FROM wallet_transactions
      WHERE reference_id = ${id}
        AND direction    = 'out'
        AND reason       = 'order_payment'
      ORDER BY created_at ASC
      LIMIT 1
    `;

    // Step 3 — delete old payment (trigger: wallet USD in reversal + order.paid_usd reversed)
    await tx`DELETE FROM order_payments WHERE id = ${id}`;

    // Link the auto-created reversal row to the original
    if (originalTx) {
      await tx`
        UPDATE wallet_transactions
        SET corrects_id = ${originalTx.id}
        WHERE reference_id = ${id}
          AND direction    = 'in'
          AND reason       = 'order_payment'
        ORDER BY created_at DESC
        LIMIT 1
      `;
    }

    // Step 4 — insert corrected payment (trigger: wallet USD out + order.paid_usd updated)
    const [newPayment] = await tx<OrderPayment[]>`
      INSERT INTO order_payments (order_id, amount_usd, payment_method, reference, notes, paid_at)
      VALUES (
        ${existing.order_id},
        ${newAmount.toFixed(2)}::numeric,
        ${(input.payment_method ?? existing.payment_method)}::payment_method,
        ${input.reference ?? existing.reference},
        ${input.notes     ?? existing.notes},
        ${input.paid_at   ?? existing.paid_at}
      )
      RETURNING *
    `;

    // Link correction wallet row to the reversal
    if (originalTx) {
      const [reversalTx] = await tx<{ id: string }[]>`
        SELECT id FROM wallet_transactions
        WHERE reference_id = ${id}
          AND direction    = 'in'
          AND reason       = 'order_payment'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (reversalTx) {
        await tx`
          UPDATE wallet_transactions
          SET corrects_id = ${reversalTx.id}
          WHERE reference_id = ${newPayment.id}
            AND direction    = 'out'
            AND reason       = 'order_payment'
          ORDER BY created_at DESC
          LIMIT 1
        `;
      }
    }

    // Step 5 — apply new allocations
    const allocations = await Promise.all(
      input.allocations!.map(async (alloc) => {
        const [instalment] = await tx`
          SELECT amount_remaining FROM order_instalments
          WHERE id = ${alloc.instalment_id}
          FOR UPDATE
        `;
        if (!instalment) throw new Error(`Instalment ${alloc.instalment_id} not found`);
        if (alloc.amount_allocated > Number(instalment.amount_remaining)) {
          throw new Error(
            `Allocation (${alloc.amount_allocated}) exceeds remaining (${instalment.amount_remaining})`
          );
        }

        await tx`
          INSERT INTO order_payment_instalments (order_payment_id, instalment_id, amount_allocated)
          VALUES (${newPayment.id}, ${alloc.instalment_id}, ${alloc.amount_allocated.toFixed(2)}::numeric)
        `;

        await tx`
          UPDATE order_instalments SET
            amount_paid      = amount_paid + ${alloc.amount_allocated.toFixed(2)}::numeric,
            amount_remaining = amount_due  - (amount_paid + ${alloc.amount_allocated.toFixed(2)}::numeric)
          WHERE id = ${alloc.instalment_id}
        `;

        return {
          instalment_id:    alloc.instalment_id,
          amount_allocated: String(alloc.amount_allocated),
        };
      })
    );

    // await syncOrderInstalmentStatuses(existing.order_id);

    return { ...newPayment, allocations };
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Deletes an order payment and reverses all instalment allocations.
 * DB trigger fires on DELETE and automatically reverses wallet + order.paid_usd.
 */
export async function deleteOrderPayment(paymentId: string): Promise<void> {
  const existing = await getOrderPaymentById(paymentId);
  if (!existing) throw new Error("Payment not found");

  await sql.begin(async (tx) => {
    // Reverse instalment allocations
    await Promise.all(
      existing.allocations.map((alloc) =>
        tx`
          UPDATE order_instalments SET
            amount_paid      = GREATEST(0, amount_paid - ${alloc.amount_allocated}::numeric),
            amount_remaining = amount_due - GREATEST(0, amount_paid - ${alloc.amount_allocated}::numeric)
          WHERE id = ${alloc.instalment_id}
        `
      )
    );

    // Delete payment — DB trigger reverses wallet & order.paid_usd
    await tx`DELETE FROM order_payments WHERE id = ${paymentId}`;

    // await syncOrderInstalmentStatuses(existing.order_id);
  });
}

// ── Auto-allocate helper ──────────────────────────────────────────────────────

/**
 * Returns allocations targeting oldest unpaid instalments first.
 * Use to pre-fill the allocations array before calling createOrderPayment.
 */
export async function buildOrderPaymentAllocations(
  orderId:   string,
  amountUsd: number,
): Promise<OrderPaymentAllocation[]> {
  const instalments = await sql<{
    id:               string;
    amount_remaining: string;
  }[]>`
    SELECT id, amount_remaining
    FROM order_instalments
    WHERE order_id = ${orderId} AND amount_remaining > 0
    ORDER BY instalment_number ASC
  `;

  const allocations: OrderPaymentAllocation[] = [];
  let remaining = amountUsd;

  for (const inst of instalments) {
    if (remaining <= 0) break;
    const canAllocate = Math.min(remaining, Number(inst.amount_remaining));
    allocations.push({ instalment_id: inst.id, amount_allocated: canAllocate });
    remaining -= canAllocate;
  }

  return allocations;
}
