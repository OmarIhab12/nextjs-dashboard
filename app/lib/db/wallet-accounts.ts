// app/lib/db/wallet-accounts.ts

import sql from '@/app/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WalletAccount = {
  id:         string;
  currency:   'EGP' | 'USD';
  method:     string;
  balance:    string;
  updated_at: string;
};

export type WalletTransfer = {
  id:              string;
  currency:        'EGP' | 'USD';
  amount:          string;
  from_account_id: string;
  to_account_id:   string;
  notes:           string | null;
  transferred_at:  string;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getWalletAccounts(): Promise<WalletAccount[]> {
  return sql<WalletAccount[]>`
    SELECT * FROM wallet_accounts
    ORDER BY currency ASC, method ASC
  `;
}

export async function getRecentTransfers(limit = 10): Promise<
  (WalletTransfer & { from_method: string; to_method: string })[]
> {
  return sql<(WalletTransfer & { from_method: string; to_method: string })[]>`
    SELECT
      wt.*,
      fa.method AS from_method,
      ta.method AS to_method
    FROM wallet_transfers wt
    JOIN wallet_accounts fa ON fa.id = wt.from_account_id
    JOIN wallet_accounts ta ON ta.id = wt.to_account_id
    ORDER BY wt.transferred_at DESC
    LIMIT ${limit}
  `;
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createWalletTransfer(input: {
  currency:        'EGP' | 'USD';
  amount:          number;
  from_account_id: string;
  to_account_id:   string;
  notes?:          string;
}): Promise<void> {
  await sql`
    INSERT INTO wallet_transfers
      (currency, amount, from_account_id, to_account_id, notes)
    VALUES (
      ${input.currency},
      ${input.amount.toFixed(2)}::numeric,
      ${input.from_account_id},
      ${input.to_account_id},
      ${input.notes ?? null}
    )
  `;
}