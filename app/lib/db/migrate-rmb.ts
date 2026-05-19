// app/lib/db/migrate-rmb.ts
// Replaces USD with RMB on orders/payments and adds RMB to wallet.
// Run with: npx tsx app/lib/db/migrate-rmb.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Starting RMB migration...\n');

  // ── 1. Add RMB to wallet_currency enum ───────────────────────────────────
  await sql`
    DO $$ BEGIN
      ALTER TYPE wallet_currency ADD VALUE IF NOT EXISTS 'RMB';
    END $$
  `;
  console.log('✓ RMB added to wallet_currency enum');

  // ── 2. Add rmb_balance to company_wallet ─────────────────────────────────
  await sql`
    ALTER TABLE company_wallet
    ADD COLUMN IF NOT EXISTS rmb_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00
  `;
  console.log('✓ rmb_balance added to company_wallet');

  // ── 3. Add RMB accounts to wallet_accounts ───────────────────────────────
  const [{ has_accounts }] = await sql<{ has_accounts: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_accounts'
    ) AS has_accounts
  `;

  if (has_accounts) {
    const methods = ['bank_transfer', 'cash', 'check', 'vodafone_cash'];
    for (const method of methods) {
      await sql`
        INSERT INTO wallet_accounts (currency, method, balance)
        VALUES ('RMB', ${method}::payment_method, 0.00)
        ON CONFLICT (currency, method) DO NOTHING
      `;
    }
    console.log('✓ RMB accounts added to wallet_accounts');
  } else {
    console.log('⚠ wallet_accounts not found — skipping (run migrate-wallet-accounts.ts first)');
  }

  // ── 4. Rename total_usd → total_rmb on orders ────────────────────────────
  const [{ has_total_usd }] = await sql<{ has_total_usd: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'total_usd'
    ) AS has_total_usd
  `;
  if (has_total_usd) {
    await sql`ALTER TABLE orders RENAME COLUMN total_usd TO total_rmb`;
    console.log('✓ orders.total_usd renamed to total_rmb');
  } else {
    console.log('⚠ orders.total_usd not found — already renamed or schema already updated');
  }

  // ── 5. Rename amount_usd → amount_rmb on order_payments ──────────────────
  const [{ has_amount_usd }] = await sql<{ has_amount_usd: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'order_payments' AND column_name = 'amount_usd'
    ) AS has_amount_usd
  `;
  if (has_amount_usd) {
    await sql`ALTER TABLE order_payments RENAME COLUMN amount_usd TO amount_rmb`;
    console.log('✓ order_payments.amount_usd renamed to amount_rmb');
  } else {
    console.log('⚠ order_payments.amount_usd not found — already renamed');
  }

  // ── 6. Update currency_conversions direction to TEXT with check ───────────
  // We can't add values to an enum if conversions direction was stored as enum,
  // so convert to TEXT with a CHECK constraint that includes RMB pairs.
  const [{ direction_type }] = await sql<{ direction_type: string }[]>`
    SELECT data_type AS direction_type
    FROM information_schema.columns
    WHERE table_name = 'currency_conversions' AND column_name = 'direction'
  `;

  if (direction_type !== 'text') {
    await sql`ALTER TABLE currency_conversions ALTER COLUMN direction TYPE TEXT`;
    console.log('✓ currency_conversions.direction converted to TEXT');
  }

  // Drop old constraint if exists, re-add with RMB pairs
  await sql`
    ALTER TABLE currency_conversions
    DROP CONSTRAINT IF EXISTS currency_conversions_direction_check
  `;
  await sql`
    ALTER TABLE currency_conversions
    ADD CONSTRAINT direction_check CHECK (
      direction IN (
        'egp_to_usd', 'usd_to_egp',
        'egp_to_rmb', 'rmb_to_egp',
        'usd_to_rmb', 'rmb_to_usd'
      )
    )
  `;
  console.log('✓ currency_conversions direction constraint updated');

  // ── 7. Add rmb_amount column to currency_conversions ─────────────────────
  await sql`
    ALTER TABLE currency_conversions
    ADD COLUMN IF NOT EXISTS rmb_amount NUMERIC(14,2)
  `;
  console.log('✓ rmb_amount added to currency_conversions');

  // ── 8. Update fn_order_payment_sync_wallet (USD → RMB) ───────────────────
  if (has_accounts) {
    await sql`
      CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at, account_id)
          SELECT 'RMB', NEW.amount_rmb, 'out', 'order_payment', NEW.id, NEW.paid_at, wa.id
          FROM wallet_accounts wa
          WHERE wa.currency = 'RMB' AND wa.method = NEW.payment_method::payment_method
          LIMIT 1;

          UPDATE wallet_accounts
          SET balance    = balance - NEW.amount_rmb,
              updated_at = NOW()
          WHERE currency = 'RMB' AND method = NEW.payment_method::payment_method;

          UPDATE company_wallet
          SET rmb_balance = rmb_balance - NEW.amount_rmb,
              updated_at  = NOW();

        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at, account_id)
          SELECT 'RMB', OLD.amount_rmb, 'in', 'order_payment', OLD.id, NOW(), wa.id
          FROM wallet_accounts wa
          WHERE wa.currency = 'RMB' AND wa.method = OLD.payment_method::payment_method
          LIMIT 1;

          UPDATE wallet_accounts
          SET balance    = balance + OLD.amount_rmb,
              updated_at = NOW()
          WHERE currency = 'RMB' AND method = OLD.payment_method::payment_method;

          UPDATE company_wallet
          SET rmb_balance = rmb_balance + OLD.amount_rmb,
              updated_at  = NOW();
        END IF;
        RETURN NULL;
      END;
      $$
    `;
  } else {
    await sql`
      CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at)
          VALUES ('RMB', NEW.amount_rmb, 'out', 'order_payment', NEW.id, NEW.paid_at);
          UPDATE company_wallet
          SET rmb_balance = rmb_balance - NEW.amount_rmb, updated_at = NOW();

        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at)
          VALUES ('RMB', OLD.amount_rmb, 'in', 'order_payment', OLD.id, NOW());
          UPDATE company_wallet
          SET rmb_balance = rmb_balance + OLD.amount_rmb, updated_at = NOW();
        END IF;
        RETURN NULL;
      END;
      $$
    `;
  }
  console.log('✓ fn_order_payment_sync_wallet updated to use RMB');

  // ── 9. Update fn_conversion_sync_wallet to support all currency pairs ─────
  if (has_accounts) {
    await sql`
      CREATE OR REPLACE FUNCTION fn_conversion_sync_wallet()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      DECLARE
        from_currency TEXT;
        to_currency   TEXT;
        from_amount   NUMERIC;
        to_amount     NUMERIC;
      BEGIN
        -- Determine from/to currency and amounts based on direction
        CASE NEW.direction
          WHEN 'egp_to_usd' THEN from_currency := 'EGP'; to_currency := 'USD'; from_amount := NEW.egp_amount; to_amount := NEW.usd_amount;
          WHEN 'usd_to_egp' THEN from_currency := 'USD'; to_currency := 'EGP'; from_amount := NEW.usd_amount; to_amount := NEW.egp_amount;
          WHEN 'egp_to_rmb' THEN from_currency := 'EGP'; to_currency := 'RMB'; from_amount := NEW.egp_amount; to_amount := NEW.rmb_amount;
          WHEN 'rmb_to_egp' THEN from_currency := 'RMB'; to_currency := 'EGP'; from_amount := NEW.rmb_amount; to_amount := NEW.egp_amount;
          WHEN 'usd_to_rmb' THEN from_currency := 'USD'; to_currency := 'RMB'; from_amount := NEW.usd_amount; to_amount := NEW.rmb_amount;
          WHEN 'rmb_to_usd' THEN from_currency := 'RMB'; to_currency := 'USD'; from_amount := NEW.rmb_amount; to_amount := NEW.usd_amount;
          ELSE RAISE EXCEPTION 'Unknown direction: %', NEW.direction;
        END CASE;

        -- Write outgoing transaction
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT from_currency::wallet_currency, from_amount, 'out', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = from_currency::wallet_currency AND wa.method = 'bank_transfer'
        LIMIT 1;

        -- Write incoming transaction
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id)
        SELECT to_currency::wallet_currency, to_amount, 'in', 'conversion', NEW.id, NEW.converted_at, wa.id
        FROM wallet_accounts wa
        WHERE wa.currency = to_currency::wallet_currency AND wa.method = 'bank_transfer'
        LIMIT 1;

        -- Update wallet_accounts
        UPDATE wallet_accounts SET balance = balance - from_amount, updated_at = NOW()
        WHERE currency = from_currency::wallet_currency AND method = 'bank_transfer';

        UPDATE wallet_accounts SET balance = balance + to_amount, updated_at = NOW()
        WHERE currency = to_currency::wallet_currency AND method = 'bank_transfer';

        -- Update company_wallet totals
        UPDATE company_wallet SET
          egp_balance = egp_balance
            + CASE WHEN to_currency = 'EGP' THEN to_amount ELSE 0 END
            - CASE WHEN from_currency = 'EGP' THEN from_amount ELSE 0 END,
          usd_balance = usd_balance
            + CASE WHEN to_currency = 'USD' THEN to_amount ELSE 0 END
            - CASE WHEN from_currency = 'USD' THEN from_amount ELSE 0 END,
          rmb_balance = rmb_balance
            + CASE WHEN to_currency = 'RMB' THEN to_amount ELSE 0 END
            - CASE WHEN from_currency = 'RMB' THEN from_amount ELSE 0 END,
          updated_at = NOW();

        RETURN NULL;
      END;
      $$
    `;
  }
  console.log('✓ fn_conversion_sync_wallet updated for all currency pairs');

  // ── 10. Update wallet_transactions currency check to include RMB ──────────
  await sql`ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_currency_check`;
  console.log('✓ wallet_transactions currency check removed (wallet_currency enum handles it)');

  console.log('\n✅ RMB migration complete.');
  console.log('Next steps:');
  console.log('  1. Update orders.ts  — total_usd → total_rmb, OrderWithPaymentStatus');
  console.log('  2. Update order-payments.ts — amount_usd → amount_rmb');
  console.log('  3. Update wallet.ts  — add rmb_balance');
  console.log('  4. Update wallet-client.tsx — add RMB card and accounts');
  console.log('  5. Update currency-conversions.ts — support RMB pairs');
  console.log('  6. Update supplier-orders.tsx — USD → RMB labels');

  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});