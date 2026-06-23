// app/lib/db/currency-conversions.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConversionDirection =
  | 'egp_to_usd' | 'usd_to_egp'
  | 'egp_to_rmb' | 'rmb_to_egp'
  | 'usd_to_rmb' | 'rmb_to_usd';

export type CurrencyConversion = {
  id:            string;
  from_amount:   string;
  to_amount:     string;
  exchange_rate: string;
  direction:     ConversionDirection;
  notes:         string | null;
  converted_at:  string;
  created_by:    string;
};

export type CreateConversionInput = {
  from_amount:   number;
  to_amount:     number;
  exchange_rate: number;
  direction:     ConversionDirection;
  created_by:    string;
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
  total_from: number;
  total_to:   number;
  count:      number;
}> {
  const [row] = await sql<{
    total_from: string;
    total_to:   string;
    count:      string;
  }[]>`
    SELECT
      COALESCE(SUM(from_amount), 0)::text AS total_from,
      COALESCE(SUM(to_amount),   0)::text AS total_to,
      COUNT(*)::text                      AS count
    FROM currency_conversions
  `;
  return {
    total_from: Number(row.total_from),
    total_to:   Number(row.total_to),
    count:      parseInt(row.count),
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Records a currency conversion in either direction.
 * DB trigger (trg_conversion_sync_wallet) fires on INSERT and automatically:
 *  - egp_to_usd: EGP out + USD in, decrements egp_balance, increments usd_balance
 *  - usd_to_egp: USD out + EGP in, decrements usd_balance, increments egp_balance
 *
 * Conversions are immutable — no update or delete functions are provided.
 * If a conversion was entered incorrectly, record a correcting conversion
 * in the opposite direction to reverse the effect.
 */
export async function createConversion(
  input: CreateConversionInput,
): Promise<CurrencyConversion> {
  const [row] = await sql<CurrencyConversion[]>`
    INSERT INTO currency_conversions (from_amount, to_amount, exchange_rate, direction, notes, converted_at, created_by)
    VALUES (
      ${input.from_amount.toFixed(2)}::numeric,
      ${input.to_amount.toFixed(2)}::numeric,
      ${input.exchange_rate.toFixed(4)}::numeric,
      ${input.direction},
      ${input.notes        ?? null},
      ${input.converted_at ?? new Date()},
      ${input.created_by}
    )
    RETURNING *
  `;
  return row;
}