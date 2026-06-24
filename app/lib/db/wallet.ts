// app/lib/db/wallet.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompanyWallet = {
  id:          string;
  egp_balance: string;
  usd_balance: string;
  rmb_balance: string;
  updated_at:  string;
};

export type WalletTransaction = {
  id:           string;
  currency:     "EGP" | "USD" | "RMB";
  amount:       string;
  direction:    "in" | "out";
  reason:       "conversion" | "expense" | "order_payment" | "invoice_payment" | "customer_refund" | "opening_balance";
  reference_id: string;
  corrects_id:  string | null;
  account_id:   string | null;
  created_by:   string;
  created_at:   string;
};

// ── Wallet Queries ────────────────────────────────────────────────────────────

/**
 * Returns the single company wallet row.
 */
export async function getWallet(): Promise<CompanyWallet> {
  const [row] = await sql<CompanyWallet[]>`SELECT * FROM company_wallet LIMIT 1`;
  return row;
}

// ── Wallet Transaction Queries ────────────────────────────────────────────────

export type GetTransactionsOptions = {
  currency?:  "EGP" | "USD" | "RMB";
  direction?: "in" | "out";
  reason?:    WalletTransaction["reason"];
  from?:      Date;
  to?:        Date;
  // When true, hides reversal/correction rows (corrects_id IS NOT NULL)
  // so only the "net" original and final entries are shown.
  hideCorrections?: boolean;
  limit?:     number;
  offset?:    number;
};

export async function getWalletTransactions(
  options: GetTransactionsOptions = {},
): Promise<WalletTransaction[]> {
  const {
    currency,
    direction,
    reason,
    from,
    to,
    hideCorrections = false,
    limit  = 50,
    offset = 0,
  } = options;

  return sql<WalletTransaction[]>`
    SELECT * FROM wallet_transactions
    WHERE
      (${currency  ?? null} IS NULL OR currency  = ${currency  ?? null}::wallet_currency)  AND
      (${direction ?? null} IS NULL OR direction = ${direction ?? null}::wallet_direction)  AND
      (${reason    ?? null} IS NULL OR reason    = ${reason    ?? null}::wallet_reason)     AND
      (${from      ?? null} IS NULL OR created_at >= ${from   ?? null})                     AND
      (${to        ?? null} IS NULL OR created_at <= ${to     ?? null})                     AND
      (${hideCorrections} = false OR corrects_id IS NULL)
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getWalletTransactionCount(
  options: Pick<GetTransactionsOptions, 'currency' | 'direction' | 'reason' | 'hideCorrections'> = {},
): Promise<number> {
  const { currency, direction, reason, hideCorrections = false } = options;
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM wallet_transactions
    WHERE
      (${currency  ?? null} IS NULL OR currency  = ${currency  ?? null}::wallet_currency) AND
      (${direction ?? null} IS NULL OR direction = ${direction ?? null}::wallet_direction) AND
      (${reason    ?? null} IS NULL OR reason    = ${reason    ?? null}::wallet_reason)    AND
      (${hideCorrections} = false OR corrects_id IS NULL)
  `;
  return parseInt(row.count);
}

/**
 * Fetches a correction chain for a given transaction:
 * returns [original, reversal, correction] in chronological order.
 * Useful for showing the full edit history of a payment/expense.
 */
export async function getCorrectionChain(
  transactionId: string,
): Promise<WalletTransaction[]> {
  // Walk up to find the root of the chain
  const [root] = await sql<WalletTransaction[]>`
    WITH RECURSIVE chain AS (
      SELECT * FROM wallet_transactions WHERE id = ${transactionId}
      UNION ALL
      SELECT wt.* FROM wallet_transactions wt
      JOIN chain c ON wt.id = c.corrects_id
    )
    SELECT * FROM chain ORDER BY created_at ASC
  `;

  if (!root) return [];

  // Walk down from root to get all corrections
  return sql<WalletTransaction[]>`
    WITH RECURSIVE chain AS (
      SELECT * FROM wallet_transactions WHERE id = ${root.id}
      UNION ALL
      SELECT wt.* FROM wallet_transactions wt
      JOIN chain c ON wt.corrects_id = c.id
    )
    SELECT * FROM chain ORDER BY created_at ASC
  `;
}

/**
 * Recomputes EGP and USD balances by summing the ledger.
 * Use to verify company_wallet hasn't drifted.
 * The result should always match getWallet().
 */
export async function recomputeBalancesFromLedger(): Promise<{ egp: number; usd: number; rmb: number }> {
  const [row] = await sql<{ egp: string; usd: string; rmb: string }[]>`
    SELECT
      COALESCE(
        SUM(CASE WHEN currency = 'EGP' AND direction = 'in'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN currency = 'EGP' AND direction = 'out' THEN amount ELSE 0 END),
      0) AS egp,
      COALESCE(
        SUM(CASE WHEN currency = 'USD' AND direction = 'in'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN currency = 'USD' AND direction = 'out' THEN amount ELSE 0 END),
      0) AS usd,
      COALESCE(
        SUM(CASE WHEN currency = 'RMB' AND direction = 'in'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN currency = 'RMB' AND direction = 'out' THEN amount ELSE 0 END),
      0) AS rmb
    FROM wallet_transactions
  `;
  return { egp: Number(row.egp), usd: Number(row.usd), rmb: Number(row.rmb) };
}

// ── Transactions Page ─────────────────────────────────────────────────────────

export type TransactionRow = WalletTransaction & {
  created_by_name: string;
};

const TRANSACTIONS_PER_PAGE = 10;

export async function fetchTransactionsPage(page: number): Promise<TransactionRow[]> {
  const offset = (page - 1) * TRANSACTIONS_PER_PAGE;
  return sql<TransactionRow[]>`
    SELECT wt.*, u.name AS created_by_name
    FROM wallet_transactions wt
    JOIN users u ON u.id = wt.created_by
    ORDER BY wt.created_at DESC
    LIMIT ${TRANSACTIONS_PER_PAGE} OFFSET ${offset}
  `;
}

export async function getTransactionPageCount(): Promise<number> {
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM wallet_transactions
  `;
  return Math.ceil(parseInt(count) / TRANSACTIONS_PER_PAGE);
}

// ── Dashboard Summary ─────────────────────────────────────────────────────────

export type WalletSummary = {
  egp_balance:        number;
  usd_balance:        number;
  rmb_balance:        number;
  egp_in_30d:         number;  // invoice payments received last 30 days
  egp_out_30d:        number;  // expenses paid last 30 days
  rmb_out_30d:        number;  // order payments sent last 30 days
  pending_orders_rmb: number;  // total unpaid RMB across all open orders
};

export async function getWalletSummary(): Promise<WalletSummary> {
  const wallet = await getWallet();

  const [flows] = await sql<{ egp_in: string; egp_out: string; rmb_out: string }[]>`
    SELECT
      COALESCE(SUM(CASE
        WHEN currency = 'EGP' AND direction = 'in'
          AND created_at >= NOW() - INTERVAL '30 days'
        THEN amount ELSE 0 END), 0) AS egp_in,
      COALESCE(SUM(CASE
        WHEN currency = 'EGP' AND direction = 'out'
          AND reason = 'expense'
          AND created_at >= NOW() - INTERVAL '30 days'
        THEN amount ELSE 0 END), 0) AS egp_out,
      COALESCE(SUM(CASE
        WHEN currency = 'RMB' AND direction = 'out'
          AND created_at >= NOW() - INTERVAL '30 days'
        THEN amount ELSE 0 END), 0) AS rmb_out
    FROM wallet_transactions
    WHERE corrects_id IS NULL   -- exclude reversal/correction rows from summary
  `;

  const [orders] = await sql<{ pending_rmb: string }[]>`
    SELECT COALESCE(SUM(amount_remaining), 0) AS pending_rmb
    FROM order_instalments
    WHERE status <> 'paid'
  `;

  return {
    egp_balance:        Number(wallet.egp_balance),
    usd_balance:        Number(wallet.usd_balance),
    rmb_balance:        Number(wallet.rmb_balance),
    egp_in_30d:         Number(flows.egp_in),
    egp_out_30d:        Number(flows.egp_out),
    rmb_out_30d:        Number(flows.rmb_out),
    pending_orders_rmb: Number(orders.pending_rmb),
  };
}
