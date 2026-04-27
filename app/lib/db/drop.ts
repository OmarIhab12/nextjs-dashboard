import sql from "../db";

async function drop() {
  console.log("⚠️  Dropping all database objects...");

  // Triggers
  await sql`DROP TRIGGER IF EXISTS trg_installments_updated_at    ON installments`;
  await sql`DROP TRIGGER IF EXISTS trg_invoices_updated_at         ON invoices`;
  await sql`DROP TRIGGER IF EXISTS trg_products_updated_at         ON products`;
  await sql`DROP TRIGGER IF EXISTS trg_customers_updated_at        ON customers`;
  await sql`DROP TRIGGER IF EXISTS trg_users_updated_at            ON users`;
  await sql`DROP TRIGGER IF EXISTS trg_invoice_default_installment ON invoices`;

  // Functions
  await sql`DROP FUNCTION IF EXISTS set_updated_at()`;
  await sql`DROP FUNCTION IF EXISTS create_default_installment()`;
  await sql`DROP FUNCTION IF EXISTS installments_balanced(UUID)`;

  // Tables — dependants before parents
  await sql`DROP TABLE IF EXISTS payment_installments`;
  await sql`DROP TABLE IF EXISTS payments`;
  await sql`DROP TABLE IF EXISTS installments`;
  await sql`DROP TABLE IF EXISTS invoice_items`;
  await sql`DROP TABLE IF EXISTS invoices`;
  await sql`DROP TABLE IF EXISTS products`;
  await sql`DROP TABLE IF EXISTS customers`;
  await sql`DROP TABLE IF EXISTS users`;

  // Enums
  await sql`DROP TYPE IF EXISTS payment_method`;
  await sql`DROP TYPE IF EXISTS installment_status`;
  await sql`DROP TYPE IF EXISTS discount_type`;
  await sql`DROP TYPE IF EXISTS invoice_status`;
  await sql`DROP TYPE IF EXISTS user_role`;

  // Extensions
  await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`;

  console.log("✅  All database objects dropped.");
  await sql.end();
}

drop().catch((err) => {
  console.error("❌  Drop failed:", err);
  process.exit(1);
});
