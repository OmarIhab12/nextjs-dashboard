// app/lib/db/migrate-created-by.ts
// Adds created_by (and edited_by for expenses) to all transaction-affecting tables.
// Run with: npx tsx app/lib/db/migrate-created-by.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('🛠️  Running created_by migration...\n');

  // ── Get the first user to backfill existing rows ──────────────────────────────
  const [{ first_user_id }] = await sql<{ first_user_id: string }[]>`
    SELECT id AS first_user_id FROM users ORDER BY created_at ASC LIMIT 1
  `;
  if (!first_user_id) throw new Error('No users found — seed the database first.');
  console.log(`  Using fallback user: ${first_user_id}`);

  // ── currency_conversions.created_by (NOT NULL) ───────────────────────────────
  await sql`ALTER TABLE currency_conversions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT`;
  await sql`UPDATE currency_conversions SET created_by = ${first_user_id} WHERE created_by IS NULL`;
  await sql`ALTER TABLE currency_conversions ALTER COLUMN created_by SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversions_created_by ON currency_conversions(created_by)`;
  console.log('  ✓ currency_conversions.created_by added');

  // ── wallet_transactions.created_by (NOT NULL) ─────────────────────────────────
  await sql`ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT`;
  await sql`UPDATE wallet_transactions SET created_by = ${first_user_id} WHERE created_by IS NULL`;
  await sql`ALTER TABLE wallet_transactions ALTER COLUMN created_by SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_by ON wallet_transactions(created_by)`;
  console.log('  ✓ wallet_transactions.created_by added');

  // ── payments.created_by (NOT NULL) ────────────────────────────────────────────
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT`;
  await sql`UPDATE payments SET created_by = ${first_user_id} WHERE created_by IS NULL`;
  await sql`ALTER TABLE payments ALTER COLUMN created_by SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_created_by ON payments(created_by)`;
  console.log('  ✓ payments.created_by added');

  // ── order_payments.created_by (NOT NULL) ──────────────────────────────────────
  await sql`ALTER TABLE order_payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT`;
  await sql`UPDATE order_payments SET created_by = ${first_user_id} WHERE created_by IS NULL`;
  await sql`ALTER TABLE order_payments ALTER COLUMN created_by SET NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_payments_created_by ON order_payments(created_by)`;
  console.log('  ✓ order_payments.created_by added');

  // ── expenses.created_by (NOT NULL) + expenses.edited_by (NULLABLE) ────────────
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE RESTRICT`;
  await sql`UPDATE expenses SET created_by = ${first_user_id} WHERE created_by IS NULL`;
  await sql`ALTER TABLE expenses ALTER COLUMN created_by SET NOT NULL`;
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS edited_by UUID REFERENCES users(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_edited_by  ON expenses(edited_by)`;
  console.log('  ✓ expenses.created_by and edited_by added');

  // ── Update triggers to propagate created_by into wallet_transactions ──────────

  // fn_payment_sync_wallet: pass NEW.created_by / leave NULL on DELETE reversal
  await sql`
    CREATE OR REPLACE FUNCTION fn_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
        SELECT 'EGP', NEW.amount, 'in', 'invoice_payment', NEW.id, NEW.paid_at, wa.id, NEW.created_by
        FROM wallet_accounts wa
        WHERE wa.currency = 'EGP' AND wa.method = NEW.payment_method
        LIMIT 1;

        UPDATE wallet_accounts SET balance = balance + NEW.amount, updated_at = NOW()
        WHERE currency = 'EGP' AND method = NEW.payment_method;

        UPDATE company_wallet SET egp_balance = egp_balance + NEW.amount, updated_at = NOW();

      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
        SELECT 'EGP', OLD.amount, 'out', 'invoice_payment', OLD.id, NOW(), wa.id, NULL
        FROM wallet_accounts wa
        WHERE wa.currency = 'EGP' AND wa.method = OLD.payment_method
        LIMIT 1;

        UPDATE wallet_accounts SET balance = balance - OLD.amount, updated_at = NOW()
        WHERE currency = 'EGP' AND method = OLD.payment_method;

        UPDATE company_wallet SET egp_balance = egp_balance - OLD.amount, updated_at = NOW();
      END IF;
      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_payment_sync_wallet ON payments`;
  await sql`
    CREATE TRIGGER trg_payment_sync_wallet
      AFTER INSERT OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION fn_payment_sync_wallet()
  `;
  console.log('  ✓ fn_payment_sync_wallet updated');

  // fn_order_payment_sync_wallet: pass NEW.created_by / NULL on DELETE reversal
  await sql`
    CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
        SELECT 'RMB', NEW.amount_rmb, 'out', 'order_payment', NEW.id, NEW.paid_at, wa.id, NEW.created_by
        FROM wallet_accounts wa
        WHERE wa.currency = 'RMB' AND wa.method = NEW.payment_method
        LIMIT 1;

        UPDATE wallet_accounts SET balance = balance - NEW.amount_rmb, updated_at = NOW()
        WHERE currency = 'RMB' AND method = NEW.payment_method;

        UPDATE company_wallet SET rmb_balance = rmb_balance - NEW.amount_rmb, updated_at = NOW();

      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions
          (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
        SELECT 'RMB', OLD.amount_rmb, 'in', 'order_payment', OLD.id, NOW(), wa.id, NULL
        FROM wallet_accounts wa
        WHERE wa.currency = 'RMB' AND wa.method = OLD.payment_method
        LIMIT 1;

        UPDATE wallet_accounts SET balance = balance + OLD.amount_rmb, updated_at = NOW()
        WHERE currency = 'RMB' AND method = OLD.payment_method;

        UPDATE company_wallet SET rmb_balance = rmb_balance + OLD.amount_rmb, updated_at = NOW();
      END IF;
      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_order_payment_sync_wallet ON order_payments`;
  await sql`
    CREATE TRIGGER trg_order_payment_sync_wallet
      AFTER INSERT OR DELETE ON order_payments
      FOR EACH ROW EXECUTE FUNCTION fn_order_payment_sync_wallet()
  `;
  console.log('  ✓ fn_order_payment_sync_wallet updated');

  // fn_expense_sync_wallet: pass NEW.created_by
  await sql`
    CREATE OR REPLACE FUNCTION fn_expense_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
      SELECT NEW.currency, NEW.amount, 'out', 'expense', NEW.id, NOW(), wa.id, NEW.created_by
      FROM wallet_accounts wa
      WHERE wa.currency = NEW.currency AND wa.method = NEW.payment_method
      LIMIT 1;

      UPDATE wallet_accounts SET balance = balance - NEW.amount, updated_at = NOW()
      WHERE currency = NEW.currency AND method = NEW.payment_method;

      UPDATE company_wallet SET
        egp_balance = egp_balance - CASE WHEN NEW.currency = 'EGP' THEN NEW.amount ELSE 0 END,
        usd_balance = usd_balance - CASE WHEN NEW.currency = 'USD' THEN NEW.amount ELSE 0 END,
        rmb_balance = rmb_balance - CASE WHEN NEW.currency = 'RMB' THEN NEW.amount ELSE 0 END,
        updated_at  = NOW();

      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_expense_sync_wallet ON expenses`;
  await sql`
    CREATE TRIGGER trg_expense_sync_wallet
      AFTER INSERT ON expenses
      FOR EACH ROW EXECUTE FUNCTION fn_expense_sync_wallet()
  `;
  console.log('  ✓ fn_expense_sync_wallet updated');

  // fn_return_sync_wallet: pass NEW.created_by (returns already has created_by)
  await sql`
    CREATE OR REPLACE FUNCTION fn_return_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.resolution_type = 'cash_refund' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_by)
        VALUES ('EGP', NEW.credit_amount, 'out', 'customer_refund', NEW.id, NEW.created_by);
        UPDATE company_wallet
        SET egp_balance = egp_balance - NEW.credit_amount,
            updated_at  = NOW();
      END IF;
      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_return_sync_wallet ON returns`;
  await sql`
    CREATE TRIGGER trg_return_sync_wallet
      AFTER INSERT ON returns
      FOR EACH ROW EXECUTE FUNCTION fn_return_sync_wallet()
  `;
  console.log('  ✓ fn_return_sync_wallet updated');

  // fn_conversion_sync_wallet: pass NEW.created_by for both wallet_transaction rows
  await sql`
    CREATE OR REPLACE FUNCTION fn_conversion_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
      from_currency TEXT;
      to_currency   TEXT;
    BEGIN
      CASE NEW.direction
        WHEN 'egp_to_usd' THEN from_currency := 'EGP'; to_currency := 'USD';
        WHEN 'usd_to_egp' THEN from_currency := 'USD'; to_currency := 'EGP';
        WHEN 'egp_to_rmb' THEN from_currency := 'EGP'; to_currency := 'RMB';
        WHEN 'rmb_to_egp' THEN from_currency := 'RMB'; to_currency := 'EGP';
        WHEN 'usd_to_rmb' THEN from_currency := 'USD'; to_currency := 'RMB';
        WHEN 'rmb_to_usd' THEN from_currency := 'RMB'; to_currency := 'USD';
        ELSE RAISE EXCEPTION 'Unknown conversion direction: %', NEW.direction;
      END CASE;

      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
      SELECT from_currency::wallet_currency, NEW.from_amount, 'out', 'conversion', NEW.id, NEW.converted_at, wa.id, NEW.created_by
      FROM wallet_accounts wa
      WHERE wa.currency = from_currency::wallet_currency AND wa.method = 'bank_transfer'
      LIMIT 1;

      INSERT INTO wallet_transactions
        (currency, amount, direction, reason, reference_id, created_at, account_id, created_by)
      SELECT to_currency::wallet_currency, NEW.to_amount, 'in', 'conversion', NEW.id, NEW.converted_at, wa.id, NEW.created_by
      FROM wallet_accounts wa
      WHERE wa.currency = to_currency::wallet_currency AND wa.method = 'bank_transfer'
      LIMIT 1;

      UPDATE wallet_accounts SET balance = balance - NEW.from_amount, updated_at = NOW()
      WHERE currency = from_currency::wallet_currency AND method = 'bank_transfer';

      UPDATE wallet_accounts SET balance = balance + NEW.to_amount, updated_at = NOW()
      WHERE currency = to_currency::wallet_currency AND method = 'bank_transfer';

      UPDATE company_wallet SET
        egp_balance = egp_balance
          + CASE WHEN to_currency = 'EGP' THEN NEW.to_amount   ELSE 0 END
          - CASE WHEN from_currency = 'EGP' THEN NEW.from_amount ELSE 0 END,
        usd_balance = usd_balance
          + CASE WHEN to_currency = 'USD' THEN NEW.to_amount   ELSE 0 END
          - CASE WHEN from_currency = 'USD' THEN NEW.from_amount ELSE 0 END,
        rmb_balance = rmb_balance
          + CASE WHEN to_currency = 'RMB' THEN NEW.to_amount   ELSE 0 END
          - CASE WHEN from_currency = 'RMB' THEN NEW.from_amount ELSE 0 END,
        updated_at = NOW();

      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_conversion_sync_wallet ON currency_conversions`;
  await sql`
    CREATE TRIGGER trg_conversion_sync_wallet
      AFTER INSERT ON currency_conversions
      FOR EACH ROW EXECUTE FUNCTION fn_conversion_sync_wallet()
  `;
  console.log('  ✓ fn_conversion_sync_wallet updated');

  console.log('\n✅  created_by migration complete.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
