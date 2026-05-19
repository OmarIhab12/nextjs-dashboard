// app/lib/db/drop-wallet-accounts.ts
// Reverts the wallet accounts migration.
// Run with: npx tsx app/lib/db/drop-wallet-accounts.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function drop() {
  console.log('Reverting wallet accounts migration...');

  // Triggers
  await sql`DROP TRIGGER IF EXISTS trg_wallet_transfer_sync ON wallet_transfers`;
  await sql`DROP FUNCTION IF EXISTS fn_wallet_transfer_sync()`;

  // Restore original trigger functions (without account_id logic)
  await sql`
    CREATE OR REPLACE FUNCTION fn_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
        VALUES ('EGP', NEW.amount, 'in', 'invoice_payment', NEW.id, NEW.paid_at);
        UPDATE company_wallet SET egp_balance = egp_balance + NEW.amount, updated_at = NOW();
      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
        VALUES ('EGP', OLD.amount, 'out', 'invoice_payment', OLD.id, NOW());
        UPDATE company_wallet SET egp_balance = egp_balance - OLD.amount, updated_at = NOW();
      END IF;
      RETURN NULL;
    END;
    $$
  `;

  await sql`
    CREATE OR REPLACE FUNCTION fn_expense_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
      VALUES ('EGP', NEW.amount_egp, 'out', 'expense', NEW.id, NOW());
      UPDATE company_wallet SET egp_balance = egp_balance - NEW.amount_egp, updated_at = NOW();
      RETURN NULL;
    END;
    $$
  `;

  // Remove added columns
  await sql`ALTER TABLE wallet_transactions DROP COLUMN IF EXISTS account_id`;
  await sql`ALTER TABLE expenses           DROP COLUMN IF EXISTS payment_method`;

  // Drop tables
  await sql`DROP TABLE IF EXISTS wallet_transfers`;
  await sql`DROP TABLE IF EXISTS wallet_accounts`;

  console.log('✅ Wallet accounts migration reverted.');
  await sql.end();
}

drop().catch((err) => {
  console.error('Drop failed:', err);
  process.exit(1);
});