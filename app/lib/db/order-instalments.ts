// app/lib/db/order-instalments.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderInstalment = {
  id:                string;
  order_id:          string;
  instalment_number: number;
  amount_due:        string;
  amount_paid:       string;
  amount_remaining:  string;
  due_date:          string | null;
  status:            "pending" | "paid" | "overdue";
  notes:             string | null;
  created_at:        string;
  updated_at:        string;
};

export type UpdateOrderInstalmentInput = {
  due_date?: Date | null;
  notes?:    string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getInstalmentsByOrder(
  orderId: string,
): Promise<OrderInstalment[]> {
  return sql<OrderInstalment[]>`
    SELECT * FROM order_instalments
    WHERE order_id = ${orderId}
    ORDER BY instalment_number ASC
  `;
}

export async function getOrderInstalmentById(
  id: string,
): Promise<OrderInstalment | null> {
  const [row] = await sql<OrderInstalment[]>`
    SELECT * FROM order_instalments WHERE id = ${id}
  `;
  return row ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Updates non-financial fields on an instalment (due_date, notes).
 * The DB trigger (trg_order_instalment_sync_status) automatically
 * recomputes status on every UPDATE, so changing due_date will
 * correctly flip a pending instalment to overdue if past today.
 */
export async function updateOrderInstalment(
  id:    string,
  input: UpdateOrderInstalmentInput,
): Promise<OrderInstalment> {
  const [row] = await sql<OrderInstalment[]>`
    UPDATE order_instalments SET
      due_date = CASE
        WHEN ${input.due_date !== undefined ? 'true' : 'false'} = 'true'
        THEN ${input.due_date ?? null}
        ELSE due_date
      END,
      notes = COALESCE(${input.notes ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

/**
 * Splits an existing instalment into two:
 *   - The original shrinks to firstAmount
 *   - A new instalment is appended for the remainder
 *
 * Only unpaid instalments can be split.
 * Mirrors the invoice splitInstallment pattern exactly.
 */
export async function splitOrderInstalment(
  instalmentId: string,
  firstAmount:  number,
  firstDueDate?: Date,
): Promise<void> {
  const inst = await getOrderInstalmentById(instalmentId);
  if (!inst) throw new Error("Instalment not found");
  if (Number(inst.amount_paid) > 0) {
    throw new Error("Cannot split a partially or fully paid instalment");
  }

  const remainder = Number(inst.amount_due) - firstAmount;
  if (remainder <= 0) {
    throw new Error("Split amount must be less than amount_due");
  }

  await sql.begin(async (tx) => {
    // Shift subsequent instalment numbers up to make room
    await tx`
      UPDATE order_instalments
      SET instalment_number = instalment_number + 1
      WHERE order_id = ${inst.order_id}
        AND instalment_number > ${inst.instalment_number}
    `;

    // Shrink the original — trigger recomputes status automatically
    await tx`
      UPDATE order_instalments
      SET amount_due       = ${firstAmount.toFixed(2)}::numeric,
          amount_remaining = ${firstAmount.toFixed(2)}::numeric,
          due_date         = ${firstDueDate ?? inst.due_date ?? null}
      WHERE id = ${instalmentId}
    `;

    // Insert the remainder instalment
    await tx`
      INSERT INTO order_instalments
        (order_id, instalment_number, amount_due, amount_paid, amount_remaining, status)
      VALUES (
        ${inst.order_id},
        ${inst.instalment_number + 1},
        ${remainder.toFixed(2)}::numeric,
        0.00,
        ${remainder.toFixed(2)}::numeric,
        'pending'
      )
    `;
  });
}
