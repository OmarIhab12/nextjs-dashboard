import sql from "../db";

async function drop() {
  console.log("⚠️  Dropping all database objects...");

  // ── Triggers ────────────────────────────────────────────────

  // Financial
  await sql`DROP TRIGGER IF EXISTS trg_order_payment_sync_wallet   ON order_payments`;
  await sql`DROP TRIGGER IF EXISTS trg_expense_sync_wallet         ON expenses`;
  await sql`DROP TRIGGER IF EXISTS trg_conversion_sync_wallet      ON currency_conversions`;
  await sql`DROP TRIGGER IF EXISTS trg_payment_sync_wallet         ON payments`;
  await sql`DROP TRIGGER IF EXISTS trg_order_default_instalment    ON orders`;

  // Core
  await sql`DROP TRIGGER IF EXISTS trg_order_instalments_updated_at ON order_instalments`;
  await sql`DROP TRIGGER IF EXISTS trg_orders_updated_at            ON orders`;
  await sql`DROP TRIGGER IF EXISTS trg_suppliers_updated_at         ON suppliers`;
  await sql`DROP TRIGGER IF EXISTS trg_installments_updated_at      ON installments`;
  await sql`DROP TRIGGER IF EXISTS trg_invoices_updated_at          ON invoices`;
  await sql`DROP TRIGGER IF EXISTS trg_products_updated_at          ON products`;
  await sql`DROP TRIGGER IF EXISTS trg_customers_updated_at         ON customers`;
  await sql`DROP TRIGGER IF EXISTS trg_users_updated_at             ON users`;
  await sql`DROP TRIGGER IF EXISTS trg_invoice_default_installment  ON invoices`;
  await sql`DROP TRIGGER IF EXISTS trg_stock_on_item_insert         ON invoice_items`;
  await sql`DROP TRIGGER IF EXISTS trg_stock_on_item_update         ON invoice_items`;
  await sql`DROP TRIGGER IF EXISTS trg_stock_on_item_delete         ON invoice_items`;
  await sql`DROP TRIGGER IF EXISTS trg_installment_sync_status      ON installments`;
  await sql`DROP TRIGGER IF EXISTS trg_order_instalment_sync_status ON order_instalments`;

  // ── Functions ────────────────────────────────────────────────
  await sql`DROP FUNCTION IF EXISTS fn_order_payment_sync_wallet()`;
  await sql`DROP FUNCTION IF EXISTS fn_expense_sync_wallet()`;
  await sql`DROP FUNCTION IF EXISTS fn_conversion_sync_wallet()`;
  await sql`DROP FUNCTION IF EXISTS fn_payment_sync_wallet()`;
  await sql`DROP FUNCTION IF EXISTS create_default_order_instalment()`;
  await sql`DROP FUNCTION IF EXISTS create_default_installment()`;
  await sql`DROP FUNCTION IF EXISTS installments_balanced(UUID)`;
  await sql`DROP FUNCTION IF EXISTS update_stock_on_item_insert()`;
  await sql`DROP FUNCTION IF EXISTS update_stock_on_item_update()`;
  await sql`DROP FUNCTION IF EXISTS update_stock_on_item_delete()`;
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`;
  await sql`DROP FUNCTION IF EXISTS sync_installment_status()`;
  await sql`DROP FUNCTION IF EXISTS sync_order_instalment_status()`;

  // ── Tables — dependants before parents ───────────────────────

  // Financial
  await sql`DROP TABLE IF EXISTS order_payment_instalments`;
  await sql`DROP TABLE IF EXISTS order_payments`;
  await sql`DROP TABLE IF EXISTS order_instalments`;
  await sql`DROP TABLE IF EXISTS orders`;
  await sql`DROP TABLE IF EXISTS expenses`;
  await sql`DROP TABLE IF EXISTS currency_conversions`;
  await sql`DROP TABLE IF EXISTS wallet_transactions`;
  await sql`DROP TABLE IF EXISTS company_wallet`;
  await sql`DROP TABLE IF EXISTS suppliers`;

  // Core
  await sql`DROP TABLE IF EXISTS payment_installments`;
  await sql`DROP TABLE IF EXISTS payments`;
  await sql`DROP TABLE IF EXISTS installments`;
  await sql`DROP TABLE IF EXISTS invoice_items`;
  await sql`DROP TABLE IF EXISTS invoices`;
  await sql`DROP TABLE IF EXISTS products`;
  await sql`DROP TABLE IF EXISTS customers`;
  await sql`DROP TABLE IF EXISTS users`;

  // ── Enums ────────────────────────────────────────────────────

  // Financial
  await sql`DROP TYPE IF EXISTS order_instalment_status`;
  await sql`DROP TYPE IF EXISTS order_status`;
  await sql`DROP TYPE IF EXISTS expense_recurrence`;
  await sql`DROP TYPE IF EXISTS wallet_reason`;
  await sql`DROP TYPE IF EXISTS wallet_direction`;
  await sql`DROP TYPE IF EXISTS wallet_currency`;

  // Core
  await sql`DROP TYPE IF EXISTS payment_method`;
  await sql`DROP TYPE IF EXISTS payment_status`;
  await sql`DROP TYPE IF EXISTS discount_type`;
  await sql`DROP TYPE IF EXISTS invoice_status`;
  await sql`DROP TYPE IF EXISTS user_role`;

  // ── Extensions ───────────────────────────────────────────────
  await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`;

  console.log("✅  All database objects dropped.");
  await sql.end();
}

drop().catch((err) => {
  console.error("❌  Drop failed:", err);
  process.exit(1);
});
