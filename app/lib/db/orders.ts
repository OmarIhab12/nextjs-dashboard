// app/lib/db/orders.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

// Document lifecycle — stored on the orders table, set manually by users
export type OrderStatus =
  | "draft"
  | "confirmed"
  | "shipped"
  | "arrived"
  | "stored"
  | "cancelled";

// Payment state — computed from order_instalment_status values, never stored
// Reuses the same values as order_instalment_status for consistency
export type OrderPaymentStatus = "pending" | "partial" | "paid" | "overdue";

// Raw DB row
export type Order = {
  id:           string;
  supplier_id:  string | null;
  total_usd:    string;
  status:       OrderStatus;
  notes:        string | null;
  order_date:   string;
  updated_at:   string;
  supplier_name?: string;
};

// Enriched with computed payment_status and paid_usd from instalments
export type OrderWithItems = OrderWithPaymentStatus & {
  items: OrderItemRow[];
};

export type OrderWithPaymentStatus = Order & {
  paid_usd:       number;
  payment_status: OrderPaymentStatus;
};

export type OrderItemRow = {
  id:           string;
  product_id:   string | null;
  product_name: string;
  unit_price:   string;
  quantity:     number;
  line_total:   string;
};

export type CreateOrderInput = {
  supplier_id?: string;
  total_usd:    number;
  notes?:       string;
  order_date?:  Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function derivePaymentStatus(
  totalUsd:    number,
  paidUsd:     number,
  hasOverdue:  boolean,
): OrderPaymentStatus {
  if (paidUsd >= totalUsd)          return 'paid';
  if (hasOverdue)                    return 'overdue';
  if (paidUsd > 0)                   return 'partial';
  return 'pending';
}

// ── Order Queries ─────────────────────────────────────────────────────────────

/**
 * Returns all orders enriched with paid_usd and payment_status
 * computed from order_instalments in a single query.
 */
export async function getAllOrders(): Promise<OrderWithPaymentStatus[]> {
  const rows = await sql<(Order & { paid_usd: string; has_overdue: boolean })[]>`
    SELECT
      o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at,
      s.name                                          AS supplier_name,
      COALESCE(SUM(oi.amount_paid), 0)                AS paid_usd,
      BOOL_OR(oi.status = 'overdue')                  AS has_overdue
    FROM orders o
    LEFT JOIN suppliers s          ON s.id       = o.supplier_id
    LEFT JOIN order_instalments oi ON oi.order_id = o.id
    GROUP BY o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at, s.name
    ORDER BY o.order_date DESC
  `;

  return rows.map((r) => ({
    ...r,
    paid_usd:       Number(r.paid_usd),
    payment_status: derivePaymentStatus(
      Number(r.total_usd),
      Number(r.paid_usd),
      r.has_overdue,
    ),
  }));
}

export async function getOrderById(id: string): Promise<OrderWithPaymentStatus | null> {
  const [row] = await sql<(Order & { paid_usd: string; has_overdue: boolean })[]>`
    SELECT
      o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at,
      s.name                                          AS supplier_name,
      COALESCE(SUM(oi.amount_paid), 0)                AS paid_usd,
      BOOL_OR(oi.status = 'overdue')                  AS has_overdue
    FROM orders o
    LEFT JOIN suppliers s          ON s.id       = o.supplier_id
    LEFT JOIN order_instalments oi ON oi.order_id = o.id
    WHERE o.id = ${id}
    GROUP BY o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at, s.name
  `;
  if (!row) return null;

  return {
    ...row,
    paid_usd:       Number(row.paid_usd),
    payment_status: derivePaymentStatus(
      Number(row.total_usd),
      Number(row.paid_usd),
      row.has_overdue,
    ),
  };
}

export async function fetchFilteredOrders(
  query:   string,
  page:    number,
  perPage = 10,
): Promise<OrderWithPaymentStatus[]> {
  const offset = (page - 1) * perPage;

  const rows = await sql<(Order & { paid_usd: string; has_overdue: boolean })[]>`
    SELECT
      o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at,
      s.name                                          AS supplier_name,
      COALESCE(SUM(oi.amount_paid), 0)                AS paid_usd,
      BOOL_OR(oi.status = 'overdue')                  AS has_overdue
    FROM orders o
    LEFT JOIN suppliers s          ON s.id       = o.supplier_id
    LEFT JOIN order_instalments oi ON oi.order_id = o.id
    WHERE
      s.name         ILIKE ${'%' + query + '%'} OR
      o.notes        ILIKE ${'%' + query + '%'} OR
      o.status::text ILIKE ${'%' + query + '%'}
    GROUP BY o.id, o.supplier_id, o.total_usd, o.status, o.notes, o.order_date, o.updated_at, s.name
    ORDER BY o.order_date DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  return rows.map((r) => ({
    ...r,
    paid_usd:       Number(r.paid_usd),
    payment_status: derivePaymentStatus(
      Number(r.total_usd),
      Number(r.paid_usd),
      r.has_overdue,
    ),
  }));
}

export async function getOrderCount(query = ''): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(DISTINCT o.id)::text AS count
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    WHERE
      s.name         ILIKE ${'%' + query + '%'} OR
      o.notes        ILIKE ${'%' + query + '%'} OR
      o.status::text ILIKE ${'%' + query + '%'}
  `;
  return parseInt(row.count);
}

export async function getOrderWithItems(id: string): Promise<OrderWithItems | null> {
  const order = await getOrderById(id);
  if (!order) return null;

  const items = await sql<OrderItemRow[]>`
    SELECT * FROM order_items WHERE order_id = ${id} ORDER BY id ASC
  `;

  return { ...order, items };
}

// ── Order Mutations ───────────────────────────────────────────────────────────

/**
 * Creates an order.
 * DB trigger automatically creates a single default instalment for the full amount.
 */
export async function createOrder(input: CreateOrderInput): Promise<OrderWithPaymentStatus> {
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

  return {
    ...row,
    paid_usd:       0,
    payment_status: 'pending',
  };
}

/**
 * Updates the document lifecycle status of an order.
 * This is the only writable status — payment_status is always computed.
 */
export async function updateOrderStatus(
  id:     string,
  status: OrderStatus,
): Promise<void> {
  await sql`
    UPDATE orders SET status = ${status}::order_status WHERE id = ${id}
  `;
}

export async function updateOrder(
  id:    string,
  input: Partial<Pick<CreateOrderInput, 'supplier_id' | 'notes'>> & { status?: OrderStatus },
): Promise<OrderWithPaymentStatus> {
  await sql`
    UPDATE orders SET
      supplier_id = COALESCE(${input.supplier_id ?? null}, supplier_id),
      notes       = COALESCE(${input.notes       ?? null}, notes),
      status      = COALESCE(${input.status      ?? null}::order_status, status)
    WHERE id = ${id}
  `;
  const updated = await getOrderById(id);
  if (!updated) throw new Error(`Order ${id} not found after update`);
  return updated;
}

export async function deleteOrder(id: string): Promise<void> {
  await sql`DELETE FROM order_payments WHERE order_id = ${id}`;
  await sql`DELETE FROM orders WHERE id = ${id}`;
}

// ── Instalment Queries ────────────────────────────────────────────────────────

export type OrderInstalment = {
  id:                string;
  order_id:          string;
  instalment_number: number;
  amount_due:        string;
  amount_paid:       string;
  amount_remaining:  string;
  due_date:          string | null;
  status:            "pending" | "partial" | "paid" | "overdue";
  notes:             string | null;
  created_at:        string;
  updated_at:        string;
};

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