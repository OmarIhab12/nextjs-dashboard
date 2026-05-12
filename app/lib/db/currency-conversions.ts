// app/lib/db/currency-conversions.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllConversions(): Promise<CurrencyConversion[]> {
  return sql<CurrencyConversion[]>`
    SELECT * FROM currency_conversions
    ORDER BY converted_at DESC
  `;
}

export async function getConversionById(id: string): Promise<CurrencyConversion | null> {
  const [row] = await sql<CurrencyConversion[]>`
    SELECT * FROM currency_conversions WHERE id = ${id}
  `;
  return row ?? null;
}

export async function fetchFilteredConversions(
  query:   string,
  page:    number,
  perPage = 10,
): Promise<CurrencyConversion[]> {
  const offset = (page - 1) * perPage;
  return sql<CurrencyConversion[]>`
    SELECT * FROM currency_conversions
    WHERE notes ILIKE ${'%' + query + '%'}
    ORDER BY converted_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

export async function getConversionCount(query = ''): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM currency_conversions
    WHERE notes ILIKE ${'%' + query + '%'}
  `;
  return parseInt(row.count);
}

/**
 * Returns a summary of all conversions: total EGP spent and total USD received.
 */
export async function getConversionSummary(): Promise<{
  total_egp_spent: number;
  total_usd_received: number;
  count: number;
}> {
  const [row] = await sql<{
    total_egp: string;
    total_usd: string;
    count:     string;
  }[]>`
    SELECT
      COALESCE(SUM(egp_amount), 0)::text AS total_egp,
      COALESCE(SUM(usd_amount), 0)::text AS total_usd,
      COUNT(*)::text                     AS count
    FROM currency_conversions
  `;
  return {
    total_egp_spent:    Number(row.total_egp),
    total_usd_received: Number(row.total_usd),
    count:              parseInt(row.count),
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Records a currency conversion (EGP → USD).
 * DB trigger (trg_conversion_sync_wallet) fires on INSERT and automatically:
 *  - writes two wallet_transactions (EGP out, USD in)
 *  - decrements egp_balance and increments usd_balance on company_wallet
 *
 * Conversions are immutable — no update or delete functions are provided.
 * If a conversion was entered incorrectly, record a correcting conversion
 * in the opposite direction (USD → EGP) to reverse the effect.
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
