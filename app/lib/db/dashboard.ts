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
  total_usd:     string;
  status:        string;
  order_date:    string;
};

export async function getLatestOrders(): Promise<DashboardOrder[]> {
  return sql<DashboardOrder[]>`
    SELECT
      o.id,
      s.name AS supplier_name,
      o.total_usd,
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
    JOIN invoices i     ON i.customer_id = c.id
    JOIN installments inst ON inst.invoice_id = i.id
    WHERE inst.amount_remaining > 0
    GROUP BY c.id, c.name, c.email
    ORDER BY SUM(inst.amount_remaining) DESC
    LIMIT 5
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

// ── Wallet summary ────────────────────────────────────────────────────────────

export type WalletSummary = {
  egp_balance: number;
  usd_balance: number;
};

export async function getDashboardWallet(): Promise<WalletSummary> {
  const [row] = await sql<{ egp_balance: string; usd_balance: string }[]>`
    SELECT egp_balance, usd_balance FROM company_wallet LIMIT 1
  `;
  return {
    egp_balance: Number(row?.egp_balance ?? 0),
    usd_balance: Number(row?.usd_balance ?? 0),
  };
}