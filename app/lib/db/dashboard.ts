// app/lib/db/dashboard.ts

import sql from '@/app/lib/db';

// ── Latest 5 invoices ─────────────────────────────────────────────────────────

export type DashboardInvoice = {
  id:             string;
  customer_name:  string;
  customer_email: string;
  total:          string;
  status:         string;
  created_at:     string;
};

export async function getLatestInvoices(): Promise<DashboardInvoice[]> {
  return sql<DashboardInvoice[]>`
    SELECT
      i.id,
      c.name  AS customer_name,
      c.email AS customer_email,
      i.total,
      i.status,
      i.created_at::text
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    ORDER BY i.created_at DESC
    LIMIT 5
  `;
}

// ── Latest 5 orders ───────────────────────────────────────────────────────────

export type DashboardOrder = {
  id:            string;
  supplier_name: string | null;
  total_rmb:     string;
  status:        string;
  order_date:    string;
};

export async function getLatestOrders(): Promise<DashboardOrder[]> {
  return sql<DashboardOrder[]>`
    SELECT
      o.id,
      s.name AS supplier_name,
      o.total_rmb,
      o.status,
      o.order_date::text
    FROM orders o
    LEFT JOIN suppliers s ON s.id = o.supplier_id
    ORDER BY o.order_date DESC
    LIMIT 5
  `;
}

// ── Top 5 products by quantity sold in last 6 months ─────────────────────────

export type TopProduct = {
  product_name:   string;
  total_quantity: number;
  total_revenue:  string;
};

export async function getTopProducts(): Promise<TopProduct[]> {
  return sql<TopProduct[]>`
    SELECT
      ii.product_name,
      SUM(ii.quantity)::int   AS total_quantity,
      SUM(ii.line_total)::text AS total_revenue
    FROM invoice_items ii
    JOIN invoices i ON i.id = ii.invoice_id
    WHERE i.created_at >= NOW() - INTERVAL '6 months'
    GROUP BY ii.product_name
    ORDER BY total_quantity DESC
    LIMIT 5
  `;
}

// ── Customers with most outstanding balance ───────────────────────────────────

export type CustomerDebt = {
  id:           string;
  name:         string;
  email:        string | null;
  amount_owed:  string;
};

export async function getTopDebtors(): Promise<CustomerDebt[]> {
  return sql<CustomerDebt[]>`
    SELECT
      c.id,
      c.name,
      c.email,
      SUM(inst.amount_remaining)::text AS amount_owed
    FROM customers c
    JOIN invoices i        ON i.customer_id  = c.id
    JOIN installments inst ON inst.invoice_id = i.id
    WHERE inst.amount_remaining > 0
    GROUP BY c.id, c.name, c.email
    ORDER BY SUM(inst.amount_remaining) DESC
    LIMIT 5
  `;
}

export type TopCustomer = {
  id:      string;
  name:    string;
  email:   string | null;
  total:   string;
};

export async function getTopCustomersByRevenue(): Promise<TopCustomer[]> {
  return sql<TopCustomer[]>`
    SELECT
      c.id,
      c.name,
      c.email,
      SUM(i.total)::text AS total
    FROM customers c
    JOIN invoices i ON i.customer_id = c.id
    GROUP BY c.id, c.name, c.email
    ORDER BY SUM(i.total) DESC
    LIMIT 5
  `;
}
export async function getAllDebtors(): Promise<CustomerDebt[]> {
  return sql<CustomerDebt[]>`
    SELECT
      c.id,
      c.name,
      c.email,
      SUM(inst.amount_remaining)::text AS amount_owed
    FROM customers c
    JOIN invoices i        ON i.customer_id  = c.id
    JOIN installments inst ON inst.invoice_id = i.id
    WHERE inst.amount_remaining > 0
    GROUP BY c.id, c.name, c.email
    ORDER BY SUM(inst.amount_remaining) DESC
  `;
}

// ── Monthly sales revenue for last 12 months ─────────────────────────────────

export type MonthlySales = {
  month:   string;   // e.g. 'Jan', 'Feb'
  revenue: number;
};

export async function getMonthlySales(): Promise<MonthlySales[]> {
  const rows = await sql<{ month: string; revenue: string }[]>`
    SELECT
      TO_CHAR(gs.month_start, 'Mon YY')        AS month,
      COALESCE(SUM(i.total), 0)::text           AS revenue
    FROM generate_series(
      DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) AS gs(month_start)
    LEFT JOIN invoices i
      ON DATE_TRUNC('month', i.created_at) = gs.month_start
    GROUP BY gs.month_start
    ORDER BY gs.month_start ASC
  `;

  return rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));
}

export async function getMonthlyPayments(): Promise<MonthlySales[]> {
  const rows = await sql<{ month: string; revenue: string }[]>`
    SELECT
      TO_CHAR(gs.month_start, 'Mon YY')        AS month,
      COALESCE(SUM(p.amount), 0)::text           AS revenue
    FROM generate_series(
      DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) AS gs(month_start)
    LEFT JOIN payments p
      ON DATE_TRUNC('month', p.created_at) = gs.month_start
    GROUP BY gs.month_start
    ORDER BY gs.month_start ASC
  `;

  return rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));
}

// ── Net cash flow (sales vs payments) ─────────────────────────────────────────

export type MonthlyNetFlow = {
  month:                  string;
  sales:                  number;
  payments:               number;
  expenses:               number;
  supplier_payments_rmb:  number;
};

export async function getMonthlyNetFlow(): Promise<MonthlyNetFlow[]> {
  const rows = await sql<{
    month: string; sales: string; payments: string;
    expenses: string; supplier_payments_rmb: string;
  }[]>`
    WITH months AS (
      SELECT generate_series(
        DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
        DATE_TRUNC('month', NOW()),
        '1 month'::interval
      ) AS month_start
    ),
    monthly_sales AS (
      SELECT DATE_TRUNC('month', created_at) AS m, SUM(total) AS total
      FROM invoices GROUP BY m
    ),
    monthly_payments AS (
      SELECT DATE_TRUNC('month', created_at) AS m, SUM(amount) AS total
      FROM payments GROUP BY m
    ),
    monthly_expenses AS (
      SELECT DATE_TRUNC('month', expense_date) AS m,
             SUM(CASE WHEN currency = 'EGP' THEN amount ELSE 0 END) AS total
      FROM expenses GROUP BY m
    ),
    monthly_supplier_payments AS (
      SELECT DATE_TRUNC('month', paid_at) AS m, SUM(amount_rmb) AS total
      FROM order_payments GROUP BY m
    )
    SELECT
      TO_CHAR(months.month_start, 'Mon YY')                    AS month,
      COALESCE(monthly_sales.total,              0)::text      AS sales,
      COALESCE(monthly_payments.total,           0)::text      AS payments,
      COALESCE(monthly_expenses.total,           0)::text      AS expenses,
      COALESCE(monthly_supplier_payments.total,  0)::text      AS supplier_payments_rmb
    FROM months
    LEFT JOIN monthly_sales              ON monthly_sales.m              = months.month_start
    LEFT JOIN monthly_payments           ON monthly_payments.m           = months.month_start
    LEFT JOIN monthly_expenses           ON monthly_expenses.m           = months.month_start
    LEFT JOIN monthly_supplier_payments  ON monthly_supplier_payments.m  = months.month_start
    ORDER BY months.month_start ASC
  `;

  return rows.map((r) => ({
    month:                 r.month,
    sales:                 Number(r.sales),
    payments:              Number(r.payments),
    expenses:              Number(r.expenses),
    supplier_payments_rmb: Number(r.supplier_payments_rmb),
  }));
}

// ── Monthly expenses (EGP) ────────────────────────────────────────────────────

export async function getMonthlyExpenses(): Promise<MonthlySales[]> {
  const rows = await sql<{ month: string; revenue: string }[]>`
    SELECT
      TO_CHAR(gs.month_start, 'Mon YY')                                    AS month,
      COALESCE(SUM(CASE WHEN e.currency = 'EGP' THEN e.amount ELSE 0 END), 0)::text AS revenue
    FROM generate_series(
      DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
      DATE_TRUNC('month', NOW()),
      '1 month'::interval
    ) AS gs(month_start)
    LEFT JOIN expenses e ON DATE_TRUNC('month', e.expense_date) = gs.month_start
    GROUP BY gs.month_start
    ORDER BY gs.month_start ASC
  `;

  return rows.map((r) => ({ month: r.month, revenue: Number(r.revenue) }));
}

// ── Orders by status ──────────────────────────────────────────────────────────

export type OrderStatusItem = {
  status: string;
  count:  number;
};

export async function getOrdersByStatus(): Promise<OrderStatusItem[]> {
  return sql<OrderStatusItem[]>`
    SELECT status::text, COUNT(*)::int AS count
    FROM orders
    GROUP BY status
    ORDER BY count DESC
  `;
}

// ── Invoices by payment status ────────────────────────────────────────────────

export async function getInvoicesByStatus(): Promise<OrderStatusItem[]> {
  return sql<OrderStatusItem[]>`
    SELECT payment_status AS status, COUNT(*)::int AS count
    FROM (
      SELECT
        i.id,
        CASE
          WHEN SUM(inst.amount_due) = SUM(inst.amount_paid)                                       THEN 'paid'
          WHEN i.due_date < CURRENT_DATE AND SUM(inst.amount_paid) < SUM(inst.amount_due)         THEN 'overdue'
          WHEN SUM(inst.amount_paid) > 0 AND SUM(inst.amount_paid) < SUM(inst.amount_due)         THEN 'partial'
          ELSE 'pending'
        END AS payment_status
      FROM invoices i
      JOIN installments inst ON inst.invoice_id = i.id
      GROUP BY i.id, i.due_date
    ) sub
    GROUP BY payment_status
    ORDER BY count DESC
  `;
}

// ── Pending shipments (orders not yet stored) ─────────────────────────────────

export type PendingShipmentsSummary = {
  order_count: number;
  total_rmb:   number;
  total_units: number;
};

export async function getPendingShipments(): Promise<PendingShipmentsSummary> {
  const [row] = await sql<{ order_count: string; total_rmb: string; total_units: string }[]>`
    SELECT
      COUNT(DISTINCT o.id)::text          AS order_count,
      COALESCE(SUM(o.total_rmb), 0)::text AS total_rmb,
      COALESCE(SUM(oi.quantity), 0)::text  AS total_units
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status <> 'stored'
  `;
  return {
    order_count: Number(row?.order_count ?? 0),
    total_rmb:   Number(row?.total_rmb   ?? 0),
    total_units: Number(row?.total_units  ?? 0),
  };
}

// ── Inventory value ───────────────────────────────────────────────────────────

export type InventorySummary = {
  total_value:    number;
  total_units:    number;
  total_products: number;
};

export async function getInventoryValue(): Promise<InventorySummary> {
  const [row] = await sql<{ total_value: string; total_units: string; total_products: string }[]>`
    SELECT
      COALESCE(SUM(stock_quantity * price), 0)::text AS total_value,
      COALESCE(SUM(stock_quantity), 0)::text         AS total_units,
      COUNT(*)::text                                  AS total_products
    FROM products
    WHERE is_active = true
  `;
  return {
    total_value:    Number(row?.total_value    ?? 0),
    total_units:    Number(row?.total_units    ?? 0),
    total_products: Number(row?.total_products ?? 0),
  };
}

// ── Wallet summary ────────────────────────────────────────────────────────────

export type WalletSummary = {
  egp_balance: number;
  usd_balance: number;
  rmb_balance: number;
};

export async function getDashboardWallet(): Promise<WalletSummary> {
  const [row] = await sql<{ egp_balance: string; usd_balance: string; rmb_balance: string }[]>`
    SELECT egp_balance, usd_balance, rmb_balance FROM company_wallet LIMIT 1
  `;
  return {
    egp_balance: Number(row?.egp_balance ?? 0),
    usd_balance: Number(row?.usd_balance ?? 0),
    rmb_balance: Number(row?.rmb_balance ?? 0),
  };
}