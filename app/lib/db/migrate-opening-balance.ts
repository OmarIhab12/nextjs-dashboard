// app/lib/db/migrate-opening-balance.ts
// Adds 'opening_balance' to the wallet_reason enum.
// Run with: npx tsx app/lib/db/migrate-opening-balance.ts
//
// Run this before seed-opening-balances.ts.

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function migrate() {
  console.log('Starting opening balance migration...\n');

  // ALTER TYPE ADD VALUE must be a top-level statement — not inside a DO block
  // or explicit transaction, otherwise PostgreSQL rejects it.
  await sql`ALTER TYPE wallet_reason ADD VALUE IF NOT EXISTS 'opening_balance'`;
  console.log("✓ 'opening_balance' added to wallet_reason enum");

  console.log('\n✅ Migration complete.');
  await sql.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
