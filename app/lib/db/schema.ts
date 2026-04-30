import sql from "@/app/lib/db";

async function schema() {
  console.log("🛠️  Creating schema...");

  // ── Extensions ─────────────────────────────────────────────
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  // ── Enums ──────────────────────────────────────────────────
  await sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE invoice_status AS ENUM ('draft', 'confirmed', 'cancelled', 'shipped');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE discount_type AS ENUM ('percentage', 'amount');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;
  await sql`
    DO $$ BEGIN
      CREATE TYPE payment_method AS ENUM ('bank_transfer', 'cash', 'card', 'check', 'other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `;

  // ── Users ───────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      name          VARCHAR(255) NOT NULL,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password      TEXT         NOT NULL,
      role          user_role    NOT NULL DEFAULT 'staff',
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  // ── Customers ───────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      name       VARCHAR(255) NOT NULL,
      image_url  VARCHAR(255),
      email      VARCHAR(255) UNIQUE,
      phone      VARCHAR(50),
      address    TEXT,
      city       VARCHAR(100),
      country    VARCHAR(100),
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  // ── Products ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      name           VARCHAR(255)   NOT NULL,
      description    TEXT,
      sku            VARCHAR(100)   UNIQUE,
      price          NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      stock_quantity INT            NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      is_active      BOOLEAN        NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── Invoices ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id     UUID           NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      created_by      UUID           NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
      status          invoice_status NOT NULL DEFAULT 'draft',
      discount_type   discount_type  NOT NULL DEFAULT 'percentage',
      discount_value  NUMERIC(12, 2) NOT NULL Default 0 CHECK(discount_value >= 0),
      subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      total           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      due_date        DATE,
      notes           TEXT,
      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

      CONSTRAINT discount_consistency CHECK (
        (discount_type IS NULL AND discount_value IS NULL)
        OR
        (discount_type IS NOT NULL AND discount_value IS NOT NULL)
      )
    )
  `;

  // ── Invoice Items ───────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id   UUID           NOT NULL REFERENCES invoices(id)  ON DELETE CASCADE,
      product_id   UUID           REFERENCES products(id)           ON DELETE SET NULL,
      product_name VARCHAR(255)   NOT NULL,
      unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      quantity     INT            NOT NULL CHECK (quantity > 0),
      line_total   NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
      UNIQUE (invoice_id, product_id)
  `;

  // ── Installments ────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS installments (
      id                 UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id         UUID               NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      installment_number INT                NOT NULL CHECK (installment_number > 0),
      amount_due         NUMERIC(12, 2)     NOT NULL CHECK (amount_due > 0),
      amount_paid        NUMERIC(12, 2)     NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
      amount_remaining   NUMERIC(12, 2)     NOT NULL DEFAULT 0 CHECK (amount_remaining >= 0),
      due_date           DATE,
      status             payment_status NOT NULL DEFAULT 'pending',
      notes              TEXT,
      created_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

      UNIQUE (invoice_id, installment_number),

      CONSTRAINT installment_paid_cap        CHECK (amount_paid <= amount_due),
      CONSTRAINT installment_remaining_check CHECK (amount_remaining = amount_due - amount_paid)
    )
  `;

  // ── Payments ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id     UUID           NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      amount         NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      payment_method payment_method NOT NULL,
      reference      VARCHAR(255),
      notes          TEXT,
      paid_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── Payment Installments ────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS payment_installments (
      id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      payment_id       UUID           NOT NULL REFERENCES payments(id)      ON DELETE CASCADE,
      installment_id   UUID           NOT NULL REFERENCES installments(id)  ON DELETE RESTRICT,
      amount_allocated NUMERIC(12, 2) NOT NULL CHECK (amount_allocated > 0),

      UNIQUE (payment_id, installment_id)
    )
  `;

  // ── Indexes ─────────────────────────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id  ON invoices(customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_created_by   ON invoices(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_invoice  ON installments(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_status   ON installments(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_due_date ON installments(due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_invoice      ON payments(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pay_inst_payment      ON payment_installments(payment_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pay_inst_installment  ON payment_installments(installment_id)`;

  // ── updated_at trigger function ─────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$
  `;

  for (const table of ["users", "customers", "products", "invoices", "installments"]) {
    await sql.unsafe(`
      CREATE OR REPLACE TRIGGER trg_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
  }

  // ── Default installment trigger ─────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION create_default_installment()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO installments (
        invoice_id, installment_number,
        amount_due, amount_paid, amount_remaining,
        due_date, status
      ) VALUES (
        NEW.id, 1,
        NEW.total, 0, NEW.total,
        NEW.due_date, 'pending'
      );
      RETURN NEW;
    END;
    $$
  `;

  await sql`
    CREATE OR REPLACE TRIGGER trg_invoice_default_installment
      AFTER INSERT ON invoices
      FOR EACH ROW EXECUTE FUNCTION create_default_installment()
  `;

  // ── installments_balanced helper ────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION installments_balanced(p_invoice_id UUID)
    RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
      SELECT COALESCE(SUM(amount_due), 0) = (SELECT total FROM invoices WHERE id = p_invoice_id)
      FROM installments
      WHERE invoice_id = p_invoice_id;
    $$
  `;

  console.log("✅  Schema created.");
  await sql.end();
}

schema().catch((err) => {
  console.error("❌  Schema creation failed:", err);
  process.exit(1);
});
