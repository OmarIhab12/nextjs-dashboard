// app/lib/db/fix-payment-delete-created-by.ts
// Fixes fn_payment_sync_wallet and fn_order_payment_sync_wallet: their DELETE
// branches insert created_by = NULL, which violates the NOT NULL constraint
// added on wallet_transactions.created_by by migrate-created-by.ts. This has
// meant every payment/order_payment deletion has always failed at the DB
// level.
//
// A trigger has no access to the app's logged-in user, so it inserts
// OLD.created_by as an insert-time placeholder (satisfies NOT NULL). The
// caller (deletePayment / deleteOrderPayment) immediately overwrites it with
// the real acting user right after, in the same statement that sets
// corrects_id.
//
// Run with: npx tsx app/lib/db/fix-payment-delete-created-by.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Fixing fn_payment_sync_wallet / fn_order_payment_sync_wallet DELETE created_by...');

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
        SELECT 'EGP', OLD.amount, 'out', 'invoice_payment', OLD.id, NOW(), wa.id, OLD.created_by
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
  console.log('  ✓ fn_payment_sync_wallet fixed');

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
        SELECT 'RMB', OLD.amount_rmb, 'in', 'order_payment', OLD.id, NOW(), wa.id, OLD.created_by
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
  console.log('  ✓ fn_order_payment_sync_wallet fixed');

  console.log('✅ Done.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
