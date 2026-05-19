// app/lib/db/migrate-fix-order-payment-trigger.ts
// Fixes fn_order_payment_sync_wallet which still references the removed
// paid_usd and order_status columns on the orders table.
//
// Run with: npx tsx app/lib/db/migrate-fix-order-payment-trigger.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Fixing fn_order_payment_sync_wallet trigger...');

  // Check if wallet_accounts table exists (i.e. wallet accounts migration was run)
  const [{ exists }] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'wallet_accounts'
    ) AS exists
  `;

  if (exists) {
    console.log('wallet_accounts found — using version with account tracking');
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
        END IF;
        RETURN NULL;
      END;
      $$
    `;
  } else {
    console.log('wallet_accounts not found — using basic version');
    await sql`
      CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at)
          VALUES ('USD', NEW.amount_usd, 'out', 'order_payment', NEW.id, NEW.paid_at);

          UPDATE company_wallet
          SET usd_balance = usd_balance - NEW.amount_usd,
              updated_at  = NOW();

        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO wallet_transactions
            (currency, amount, direction, reason, reference_id, created_at)
          VALUES ('USD', OLD.amount_usd, 'in', 'order_payment', OLD.id, NOW());

          UPDATE company_wallet
          SET usd_balance = usd_balance + OLD.amount_usd,
              updated_at  = NOW();
        END IF;
        RETURN NULL;
      END;
      $$
    `;
  }

  console.log('✅ fn_order_payment_sync_wallet fixed successfully.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});