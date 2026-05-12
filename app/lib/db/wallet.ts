// app/lib/db/wallet.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompanyWallet = {
  id:          string;
  egp_balance: string;
  usd_balance: string;
  updated_at:  string;
};

export type WalletTransaction = {
  id:           string;
  currency:     "EGP" | "USD";
  amount:       string;
  direction:    "in" | "out";
  reason:       "conversion" | "expense" | "order_payment" | "invoice_payment";
  reference_id: string;
  corrects_id:  string | null;
  created_at:   string;
};

export type CurrencyConversion = {
  id:            string;
  egp_amount:    string;
  usd_amount:    string;
  exchange_rate: string;
  notes:         string | null;
  converted_at:  string;
};

export type CreateConversionInput = {
  egp_amount:    number;
  usd_amount:    number;
  exchange_rate: number;
  notes?:        string;
  converted_at?: Date;
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
  currency?:  "EGP" | "USD";
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
export async function recomputeBalancesFromLedger(): Promise<{ egp: number; usd: number }> {
  const [row] = await sql<{ egp: string; usd: string }[]>`
    SELECT
      COALESCE(
        SUM(CASE WHEN currency = 'EGP' AND direction = 'in'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN currency = 'EGP' AND direction = 'out' THEN amount ELSE 0 END),
      0) AS egp,
      COALESCE(
        SUM(CASE WHEN currency = 'USD' AND direction = 'in'  THEN amount ELSE 0 END) -
        SUM(CASE WHEN currency = 'USD' AND direction = 'out' THEN amount ELSE 0 END),
      0) AS usd
    FROM wallet_transactions
  `;
  return { egp: Number(row.egp), usd: Number(row.usd) };
}

// ── Currency Conversions ──────────────────────────────────────────────────────

export async function getAllConversions(): Promise<CurrencyConversion[]> {
  return sql<CurrencyConversion[]>`
    SELECT * FROM currency_conversions ORDER BY converted_at DESC
  `;
}

export async function getConversionById(id: string): Promise<CurrencyConversion | null> {
  const [row] = await sql<CurrencyConversion[]>`
    SELECT * FROM currency_conversions WHERE id = ${id}
  `;
  return row ?? null;
}

/**
 * Records a currency conversion (EGP → USD).
 * DB trigger automatically:
 *  - writes two wallet_transactions (EGP out, USD in)
 *  - updates both balances on company_wallet
 */
export async function createConversion(
  input: CreateConversionInput,
): Promise<CurrencyConversion> {
  const [row] = await sql<CurrencyConversion[]>`
    INSERT INTO currency_conversions (egp_amount, usd_amount, exchange_rate, notes, converted_at)
    VALUES (
      ${input.egp_amount.toFixed(2)}::numeric,
      ${input.usd_amount.toFixed(2)}::numeric,
      ${input.exchange_rate.toFixed(4)}::numeric,
      ${input.notes        ?? null},
      ${input.converted_at ?? new Date()}
    )
    RETURNING *
  `;
  return row;
}

// ── Dashboard Summary ─────────────────────────────────────────────────────────

export type WalletSummary = {
  egp_balance:        number;
  usd_balance:        number;
  egp_in_30d:         number;  // invoice payments received last 30 days
  egp_out_30d:        number;  // expenses paid last 30 days
  usd_out_30d:        number;  // order payments sent last 30 days
  pending_orders_usd: number;  // total unpaid USD across all open orders
};

export async function getWalletSummary(): Promise<WalletSummary> {
  const wallet = await getWallet();

  const [flows] = await sql<{ egp_in: string; egp_out: string; usd_out: string }[]>`
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
        WHEN currency = 'USD' AND direction = 'out'
          AND created_at >= NOW() - INTERVAL '30 days'
        THEN amount ELSE 0 END), 0) AS usd_out
    FROM wallet_transactions
    WHERE corrects_id IS NULL   -- exclude reversal/correction rows from summary
  `;

  const [orders] = await sql<{ pending_usd: string }[]>`
    SELECT COALESCE(SUM(total_usd - paid_usd), 0) AS pending_usd
    FROM orders WHERE status <> 'paid'
  `;

  return {
    egp_balance:        Number(wallet.egp_balance),
    usd_balance:        Number(wallet.usd_balance),
    egp_in_30d:         Number(flows.egp_in),
    egp_out_30d:        Number(flows.egp_out),
    usd_out_30d:        Number(flows.usd_out),
    pending_orders_usd: Number(orders.pending_usd),
  };
}
