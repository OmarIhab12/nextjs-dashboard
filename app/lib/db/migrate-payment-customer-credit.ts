// app/lib/db/migrate-payment-customer-credit.ts
// Run with: npx tsx app/lib/db/migrate-payment-customer-credit.ts
//
// Lets a `payments` row be anchored to a customer directly (no invoice_id)
// so payments made while a customer owes nothing — which become pure
// credit_balance — still show up in payment history / statements instead
// of being silently dropped.

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Starting payment/customer-credit migration...');

  await sql`ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL`;
  console.log('✓ payments.invoice_id is now nullable');

  await sql`
    ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT
  `;
  console.log('✓ payments.customer_id added');

  await sql`
    DO $$ BEGIN
      ALTER TABLE payments ADD CONSTRAINT payments_invoice_or_customer
        CHECK (invoice_id IS NOT NULL OR customer_id IS NOT NULL);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  console.log('✓ payments_invoice_or_customer constraint added');

  await sql`
    DO $$ BEGIN
      ALTER TABLE customers ADD CONSTRAINT customers_credit_balance_nonneg
        CHECK (credit_balance >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  console.log('✓ customers_credit_balance_nonneg constraint added');

  await sql`CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)`;
  console.log('✓ idx_payments_customer index created');

  // ── credit_refunds ───────────────────────────────────────────
  // Gives each "cash out of credit_balance" event its own durable record
  // (mirrors `returns`), so wallet_transactions.reference_id can point at a
  // real, individually-traceable row instead of the customer's own id.
  await sql`
    CREATE TABLE IF NOT EXISTS credit_refunds (
      id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id UUID           NOT NULL REFERENCES customers(id)       ON DELETE RESTRICT,
      account_id  UUID           NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
      amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      notes       TEXT,
      created_by  UUID           NOT NULL REFERENCES users(id)           ON DELETE RESTRICT,
      created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✓ credit_refunds table created');

  await sql`CREATE INDEX IF NOT EXISTS idx_credit_refunds_customer ON credit_refunds(customer_id)`;
  console.log('✓ idx_credit_refunds_customer index created');

  console.log('✅ Payment/customer-credit migration complete.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
