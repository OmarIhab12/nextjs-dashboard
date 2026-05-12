// app/lib/db/orders.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Order = {
  id:            string;
  supplier_id:   string | null;
  total_usd:     string;
  paid_usd:      string;
  status:        "pending" | "partial" | "paid";
  notes:         string | null;
  order_date:    string;
  updated_at:    string;
  // joined
  supplier_name?: string;
};

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

export type CreateOrderInput = {
  supplier_id?: string;
  total_usd:    number;
  notes?:       string;
  order_date?:  Date;
};

// ── Order Queries ─────────────────────────────────────────────────────────────

export async function getAllOrders(): Promise<Order[]> {
  return sql<Order[]>`
    SELECT o.*, s.name AS supplier_name
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    ORDER BY o.order_date DESC
  `;
}

export async function getOrderById(id: string): Promise<Order | null> {
  const [row] = await sql<Order[]>`
    SELECT o.*, s.name AS supplier_name
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    WHERE o.id = ${id}
  `;
  return row ?? null;
}

export async function fetchFilteredOrders(
  query:   string,
  page:    number,
  perPage = 10,
): Promise<Order[]> {
  const offset = (page - 1) * perPage;
  return sql<Order[]>`
    SELECT o.*, s.name AS supplier_name
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    WHERE
      s.name         ILIKE ${'%' + query + '%'} OR
      o.notes        ILIKE ${'%' + query + '%'} OR
      o.status::text ILIKE ${'%' + query + '%'}
    ORDER BY o.order_date DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

export async function getOrderCount(query = ''): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(o.*)::text AS count
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    WHERE
      s.name         ILIKE ${'%' + query + '%'} OR
      o.notes        ILIKE ${'%' + query + '%'} OR
      o.status::text ILIKE ${'%' + query + '%'}
  `;
  return parseInt(row.count);
}

// ── Order Mutations ───────────────────────────────────────────────────────────

/**
 * Creates an order.
 * DB trigger automatically creates a single default instalment for the full amount.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const [row] = await sql<Order[]>`
    INSERT INTO orders (supplier_id, total_usd, notes, order_date)
    VALUES (
      ${input.supplier_id ?? null},
      ${input.total_usd.toFixed(2)}::numeric,
      ${input.notes      ?? null},
      ${input.order_date ?? new Date()}
    )
    RETURNING *
  `;
  return row;
}

export async function updateOrder(
  id:    string,
  input: Partial<Pick<CreateOrderInput, 'supplier_id' | 'notes'>>,
): Promise<Order> {
  const [row] = await sql<Order[]>`
    UPDATE orders SET
      supplier_id = COALESCE(${input.supplier_id ?? null}, supplier_id),
      notes       = COALESCE(${input.notes       ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

export async function deleteOrder(id: string): Promise<void> {
  // Clear payments first (restricted FK), instalments cascade automatically
  await sql`DELETE FROM order_payments WHERE order_id = ${id}`;
  await sql`DELETE FROM orders WHERE id = ${id}`;
}

// ── Instalment Queries ────────────────────────────────────────────────────────

export async function getInstalmentsByOrder(orderId: string): Promise<OrderInstalment[]> {
  return sql<OrderInstalment[]>`
    SELECT * FROM order_instalments
    WHERE order_id = ${orderId}
    ORDER BY instalment_number ASC
  `;
}

export async function getInstalmentById(id: string): Promise<OrderInstalment | null> {
  const [row] = await sql<OrderInstalment[]>`
    SELECT * FROM order_instalments WHERE id = ${id}
  `;
  return row ?? null;
}

// ── Instalment Mutations ──────────────────────────────────────────────────────

/**
 * Splits an existing instalment into two:
 *   - The original shrinks to `firstAmount`
 *   - A new instalment is appended for the remainder
 * Mirrors the invoice splitInstallment pattern exactly.
 */
export async function splitOrderInstalment(
  instalmentId: string,
  firstAmount:  number,
  firstDueDate?: Date,
): Promise<void> {
  const inst = await getInstalmentById(instalmentId);
  if (!inst) throw new Error("Instalment not found");

  const remainder = Number(inst.amount_due) - firstAmount;
  if (remainder <= 0) throw new Error("Split amount must be less than amount_due");

  // Shift subsequent instalment numbers up to make room
  await sql`
    UPDATE order_instalments
    SET instalment_number = instalment_number + 1
    WHERE order_id = ${inst.order_id}
      AND instalment_number > ${inst.instalment_number}
  `;

  // Shrink the original
  await sql`
    UPDATE order_instalments
    SET amount_due       = ${firstAmount.toFixed(2)}::numeric,
        amount_remaining = ${firstAmount.toFixed(2)}::numeric,
        due_date         = ${firstDueDate ?? inst.due_date ?? null}
    WHERE id = ${instalmentId}
  `;

  // Create the remainder instalment
  await sql`
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
}

/**
 * Syncs instalment statuses based on payment state and due dates.
 * Call after any payment create/update/delete on an order.
 */
// export async function syncOrderInstalmentStatuses(orderId: string): Promise<void> {
//   await sql`
//     UPDATE order_instalments
//     SET status = CASE
//       WHEN amount_remaining = 0
//         THEN 'paid'::order_instalment_status
//       WHEN due_date < CURRENT_DATE AND amount_remaining > 0
//         THEN 'overdue'::order_instalment_status
//       ELSE 'pending'::order_instalment_status
//     END
//     WHERE order_id = ${orderId}
//   `;
// }
