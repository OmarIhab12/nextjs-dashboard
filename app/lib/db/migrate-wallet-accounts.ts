// app/lib/db/migrate-wallet-accounts.ts
// Run with: npx tsx app/lib/db/migrate-wallet-accounts.ts
//
// Adds:
//   - wallet_accounts table (per-method balances for EGP and USD)
//   - wallet_transfers table (moving money between accounts)
//   - account_id column on wallet_transactions
//   - payment_method column on expenses
//   - Seeds default accounts from existing company_wallet balances

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Starting wallet accounts migration...');

  // ── 1. wallet_accounts ────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      currency       wallet_currency NOT NULL,
      method         payment_method  NOT NULL,
      balance        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
      updated_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
      UNIQUE (currency, method)
    )
  `;
  console.log('✓ wallet_accounts table created');

  // ── 2. Seed default accounts ──────────────────────────────────────────────
  // EGP accounts — put existing egp_balance into bank by default
  const [wallet] = await sql<{ egp_balance: string; usd_balance: string }[]>`
    SELECT egp_balance, usd_balance FROM company_wallet LIMIT 1
  `;

  const egpMethods = ['bank_transfer', 'cash', 'check', 'vodafone_cash'];
  const usdMethods = ['bank_transfer', 'cash', 'check', 'vodafone_cash'];

  for (const method of egpMethods) {
    const balance = method === 'bank_transfer' ? wallet?.egp_balance ?? '0' : '0';
    await sql`
      INSERT INTO wallet_accounts (currency, method, balance)
      VALUES ('EGP', ${method}::payment_method, ${balance}::numeric)
      ON CONFLICT (currency, method) DO NOTHING
    `;
  }

  for (const method of usdMethods) {
    const balance = method === 'bank_transfer' ? wallet?.usd_balance ?? '0' : '0';
    await sql`
      INSERT INTO wallet_accounts (currency, method, balance)
      VALUES ('USD', ${method}::payment_method, ${balance}::numeric)
      ON CONFLICT (currency, method) DO NOTHING
    `;
  }
  console.log('✓ Default accounts seeded (existing balance placed in bank_transfer)');

  // ── 3. wallet_transfers ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS wallet_transfers (
      id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
      currency         wallet_currency NOT NULL,
      amount           NUMERIC(14, 2)  NOT NULL CHECK (amount > 0),
      from_account_id  UUID            NOT NULL REFERENCES wallet_accounts(id),
      to_account_id    UUID            NOT NULL REFERENCES wallet_accounts(id),
      notes            TEXT,
      transferred_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
      CHECK (from_account_id <> to_account_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transfers_from ON wallet_transfers(from_account_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_transfers_to   ON wallet_transfers(to_account_id)`;
  console.log('✓ wallet_transfers table created');

  // ── 4. Add account_id to wallet_transactions ──────────────────────────────
  await sql`
    ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES wallet_accounts(id) ON DELETE SET NULL
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_account ON wallet_transactions(account_id)`;
  console.log('✓ account_id added to wallet_transactions');

  // ── 5. Add payment_method to expenses ─────────────────────────────────────
  await sql`
    ALTER TABLE expenses
    ADD COLUMN IF NOT EXISTS payment_method payment_method NOT NULL DEFAULT 'cash'
  `;
  console.log('✓ payment_method added to expenses');

  // ── 6. Trigger: wallet_transfers → update wallet_accounts balances ─────────
  await sql`
    CREATE OR REPLACE FUNCTION fn_wallet_transfer_sync()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      -- Debit from account
      UPDATE wallet_accounts
      SET balance    = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.from_account_id;

      -- Credit to account
      UPDATE wallet_accounts
      SET balance    = balance + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.to_account_id;

      RETURN NEW;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_wallet_transfer_sync ON wallet_transfers`;
  await sql`
    CREATE TRIGGER trg_wallet_transfer_sync
      AFTER INSERT ON wallet_transfers
      FOR EACH ROW EXECUTE FUNCTION fn_wallet_transfer_sync()
  `;
  console.log('✓ wallet_transfers trigger created');

  // ── 7. Update fn_payment_sync_wallet to also update wallet_accounts ────────
  // Payments come in via a specific payment_method → credit that account
  await sql`
    CREATE OR REPLACE FUNCTION fn_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'EGP', NEW.amount, 'in', 'invoice_payment', NEW.id, NEW.paid_at, wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = 'EGP' AND wa.method = NEW.payment_method::payment_method
        LIMIT 1;

        UPDATE wallet_accounts
        SET balance    = balance + NEW.amount,
            updated_at = NOW()
        WHERE currency = 'EGP' AND method = NEW.payment_method::payment_method;

        UPDATE company_wallet
        SET egp_balance = egp_balance + NEW.amount,
            updated_at  = NOW();

      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'EGP', OLD.amount, 'out', 'invoice_payment', OLD.id, NOW(), wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = 'EGP' AND wa.method = OLD.payment_method::payment_method
        LIMIT 1;

        UPDATE wallet_accounts
        SET balance    = balance - OLD.amount,
            updated_at = NOW()
        WHERE currency = 'EGP' AND method = OLD.payment_method::payment_method;

        UPDATE company_wallet
        SET egp_balance = egp_balance - OLD.amount,
            updated_at  = NOW();
      END IF;

      RETURN NULL;
    END;
    $$
  `;
  console.log('✓ fn_payment_sync_wallet updated');

  // ── 8. Update fn_expense_sync_wallet to also update wallet_accounts ─────────
  await sql`
    CREATE OR REPLACE FUNCTION fn_expense_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, created_at, account_id)
      SELECT 'EGP', NEW.amount_egp, 'out', 'expense', NEW.id, NOW(), wa.id
      FROM wallet_accounts wa
      WHERE wa.currency = 'EGP' AND wa.method = NEW.payment_method::payment_method
      LIMIT 1;

      UPDATE wallet_accounts
      SET balance    = balance - NEW.amount_egp,
          updated_at = NOW()
      WHERE currency = 'EGP' AND method = NEW.payment_method::payment_method;

      UPDATE company_wallet
      SET egp_balance = egp_balance - NEW.amount_egp,
          updated_at  = NOW();

      RETURN NULL;
    END;
    $$
  `;
  console.log('✓ fn_expense_sync_wallet updated');

  // ── 9. Update fn_order_payment_sync_wallet to also update wallet_accounts ───
  await sql`
    CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'USD', NEW.amount_usd, 'out', 'order_payment', NEW.id, NEW.paid_at, wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = 'USD' AND wa.method = NEW.payment_method::payment_method
        LIMIT 1;

        UPDATE wallet_accounts
        SET balance    = balance - NEW.amount_usd,
            updated_at = NOW()
        WHERE currency = 'USD' AND method = NEW.payment_method::payment_method;

        UPDATE company_wallet
        SET usd_balance = usd_balance - NEW.amount_usd,
            updated_at  = NOW();

        UPDATE orders
        SET paid_usd   = paid_usd + NEW.amount_usd,
            status     = CASE
                           WHEN paid_usd + NEW.amount_usd >= total_usd THEN 'paid'::order_status
                           WHEN paid_usd + NEW.amount_usd  > 0         THEN 'partial'::order_status
                           ELSE 'pending'::order_status
                         END,
            updated_at = NOW()
        WHERE id = NEW.order_id;

      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'USD', OLD.amount_usd, 'in', 'order_payment', OLD.id, NOW(), wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = 'USD' AND wa.method = OLD.payment_method::payment_method
        LIMIT 1;

        UPDATE wallet_accounts
        SET balance    = balance + OLD.amount_usd,
            updated_at = NOW()
        WHERE currency = 'USD' AND method = OLD.payment_method::payment_method;

        UPDATE company_wallet
        SET usd_balance = usd_balance + OLD.amount_usd,
            updated_at  = NOW();

        UPDATE orders
        SET paid_usd   = paid_usd - OLD.amount_usd,
            status     = CASE
                           WHEN paid_usd - OLD.amount_usd >= total_usd THEN 'paid'::order_status
                           WHEN paid_usd - OLD.amount_usd  > 0         THEN 'partial'::order_status
                           ELSE 'pending'::order_status
                         END,
            updated_at = NOW()
        WHERE id = OLD.order_id;
      END IF;

      RETURN NULL;
    END;
    $$
  `;
  console.log('✓ fn_order_payment_sync_wallet updated');

  // ── 10. Update fn_conversion_sync_wallet to use accounts ──────────────────
  // Conversions always go bank ↔ bank (default to bank_transfer account)
  await sql`
    CREATE OR REPLACE FUNCTION fn_conversion_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.direction = 'egp_to_usd' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'EGP', NEW.egp_amount, 'out', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa WHERE wa.currency = 'EGP' AND wa.method = 'bank_transfer' LIMIT 1;

        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'USD', NEW.usd_amount, 'in', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa WHERE wa.currency = 'USD' AND wa.method = 'bank_transfer' LIMIT 1;

        UPDATE wallet_accounts SET balance = balance - NEW.egp_amount, updated_at = NOW()
        WHERE currency = 'EGP' AND method = 'bank_transfer';

        UPDATE wallet_accounts SET balance = balance + NEW.usd_amount, updated_at = NOW()
        WHERE currency = 'USD' AND method = 'bank_transfer';

        UPDATE company_wallet
        SET egp_balance = egp_balance - NEW.egp_amount,
            usd_balance = usd_balance + NEW.usd_amount,
            updated_at  = NOW();
      ELSE
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'USD', NEW.usd_amount, 'out', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa WHERE wa.currency = 'USD' AND wa.method = 'bank_transfer' LIMIT 1;

        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT 'EGP', NEW.egp_amount, 'in', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa WHERE wa.currency = 'EGP' AND wa.method = 'bank_transfer' LIMIT 1;

        UPDATE wallet_accounts SET balance = balance - NEW.usd_amount, updated_at = NOW()
        WHERE currency = 'USD' AND method = 'bank_transfer';

        UPDATE wallet_accounts SET balance = balance + NEW.egp_amount, updated_at = NOW()
        WHERE currency = 'EGP' AND method = 'bank_transfer';

        UPDATE company_wallet
        SET usd_balance = usd_balance - NEW.usd_amount,
            egp_balance = egp_balance + NEW.egp_amount,
            updated_at  = NOW();
      END IF;

      RETURN NULL;
    END;
    $$
  `;
  console.log('✓ fn_conversion_sync_wallet updated');

  console.log('\n✅ Wallet accounts migration complete.');
  console.log('Note: Existing EGP balance placed in bank_transfer account.');
  console.log('Note: Existing USD balance placed in bank_transfer account.');
  console.log('Run drop-wallet-accounts.ts to revert.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});