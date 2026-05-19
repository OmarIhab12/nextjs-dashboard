// app/lib/db/drop-vinslon.ts
// Drops all objects created by schema-vinslon.ts.
// Run before schema-vinslon.ts to rebuild the DB from scratch:
//   npx tsx app/lib/db/drop-vinslon.ts && npx tsx app/lib/db/schema-vinslon.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });

async function drop() {
  console.log('🗑️  Dropping schema...');

  // ── Tables (CASCADE handles FK constraints and triggers) ──────────────────────
  // Drop in leaf-first order to avoid dependency conflicts.
  const tables = [
    'order_payment_instalments',
    'payment_installments',
    'order_payments',
    'order_items',
    'order_instalments',
    'wallet_transactions',
    'wallet_transfers',
    'currency_conversions',
    'expenses',
    'payments',
    'invoice_items',
    'installments',
    'invoices',
    'wallet_accounts',
    'company_wallet',
    'orders',
    'products',
    'suppliers',
    'customers',
    'users',
  ];

  for (const table of tables) {
    await sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
  console.log('  ✓ Tables dropped');

  // ── Functions ─────────────────────────────────────────────────────────────────
  const functions = [
    'set_updated_at',
    'create_default_installment',
    'create_default_order_instalment',
    'installments_balanced',
    'update_stock_on_item_insert',
    'update_stock_on_item_update',
    'update_stock_on_item_delete',
    'update_stock_on_order_status',
    'update_stock_on_order_item_change',
    'fn_wallet_transfer_sync',
    'fn_payment_sync_wallet',
    'fn_expense_sync_wallet',
    'fn_conversion_sync_wallet',
    'fn_order_payment_sync_wallet',
  ];

  for (const fn of functions) {
    await sql.unsafe(`DROP FUNCTION IF EXISTS ${fn} CASCADE`);
  }
  console.log('  ✓ Functions dropped');

  // ── Enums ─────────────────────────────────────────────────────────────────────
  const enums = [
    'user_role',
    'invoice_status',
    'discount_type',
    'payment_status',
    'payment_method',
    'wallet_currency',
    'wallet_direction',
    'wallet_reason',
    'order_status',
    'order_instalment_status',
    'expense_recurrence',
    'expense_type',
  ];

  for (const e of enums) {
    await sql.unsafe(`DROP TYPE IF EXISTS ${e} CASCADE`);
  }
  console.log('  ✓ Enums dropped');

  console.log('✅  Schema dropped. Run schema-vinslon.ts to rebuild.');
  await sql.end();
}

drop().catch((err) => {
  console.error('❌  Drop failed:', err);
  process.exit(1);
});
