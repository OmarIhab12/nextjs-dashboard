import sql from "@/app/lib/db";

async function schema() {
  console.log("🛠️  Creating schema...");

  // ── Extensions ─────────────────────────────────────────────
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

  // ════════════════════════════════════════════════════════════
  // ENUMS
  // ════════════════════════════════════════════════════════════

  // — Core —
  await sql`DO $$ BEGIN CREATE TYPE user_role          AS ENUM ('admin', 'manager', 'staff');                       EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE invoice_status     AS ENUM ('draft', 'confirmed', 'shipped');      EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE discount_type      AS ENUM ('percentage', 'amount');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE payment_status     AS ENUM ('pending', 'partial', 'paid', 'overdue');           EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE payment_method     AS ENUM ('bank_transfer', 'cash', 'card', 'check', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  // — Financial —
  await sql`DO $$ BEGIN CREATE TYPE wallet_currency        AS ENUM ('EGP', 'USD');                                              EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE wallet_direction       AS ENUM ('in', 'out');                                               EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE wallet_reason          AS ENUM ('conversion', 'expense', 'order_payment', 'invoice_payment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE order_status           AS ENUM ('draft', 'confirmed', 'shipped', 'arrived', 'stored', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE order_instalment_status AS ENUM ('pending', 'partial', 'paid', 'overdue');                            EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
  await sql`DO $$ BEGIN CREATE TYPE expense_recurrence     AS ENUM ('once', 'monthly');                                         EXCEPTION WHEN duplicate_object THEN NULL; END $$`;

  console.log("  ✓ Enums");

  // ════════════════════════════════════════════════════════════
  // CORE TABLES
  // ════════════════════════════════════════════════════════════

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) NOT NULL UNIQUE,
      password   TEXT         NOT NULL,
      role       user_role    NOT NULL DEFAULT 'staff',
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      customer_id     UUID           NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      created_by      UUID           NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
      status          invoice_status NOT NULL DEFAULT 'draft',
      discount_type   discount_type  NOT NULL DEFAULT 'percentage',
      discount_value  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
      subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      total           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
      due_date        DATE,
      notes           TEXT,
      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      CONSTRAINT discount_consistency CHECK (
        (discount_type IS NULL AND discount_value IS NULL)
        OR (discount_type IS NOT NULL AND discount_value IS NOT NULL)
      )
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id   UUID           NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id   UUID           REFERENCES products(id)          ON DELETE SET NULL,
      product_name VARCHAR(255)   NOT NULL,
      unit_price   NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      quantity     INT            NOT NULL CHECK (quantity > 0),
      line_total   NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0),
      UNIQUE (invoice_id, product_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS installments (
      id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id         UUID           NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      installment_number INT            NOT NULL CHECK (installment_number > 0),
      amount_due         NUMERIC(12, 2) NOT NULL CHECK (amount_due > 0),
      amount_paid        NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
      amount_remaining   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (amount_remaining >= 0),
      due_date           DATE,
      status             payment_status NOT NULL DEFAULT 'pending',
      notes              TEXT,
      created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      UNIQUE (invoice_id, installment_number),
      CONSTRAINT installment_paid_cap        CHECK (amount_paid <= amount_due),
      CONSTRAINT installment_remaining_check CHECK (amount_remaining = amount_due - amount_paid)
    )
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS payment_installments (
      id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      payment_id       UUID           NOT NULL REFERENCES payments(id)     ON DELETE CASCADE,
      installment_id   UUID           NOT NULL REFERENCES installments(id) ON DELETE RESTRICT,
      amount_allocated NUMERIC(12, 2) NOT NULL CHECK (amount_allocated > 0),
      UNIQUE (payment_id, installment_id)
    )
  `;

  console.log("  ✓ Core tables");

  // ════════════════════════════════════════════════════════════
  // FINANCIAL TABLES
  // ════════════════════════════════════════════════════════════

  // ── Company Wallet (single-row live balance) ─────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS company_wallet (
      id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      egp_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      usd_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO company_wallet (egp_balance, usd_balance)
    SELECT 0.00, 0.00 WHERE NOT EXISTS (SELECT 1 FROM company_wallet)
  `;

  // ── Wallet Transactions (immutable ledger) ───────────────────
  // corrects_id: NULL on normal entries.
  // On a reversal row  → points to the original transaction it reverses.
  // On a correction row → points to the reversal row.
  // Chain: original → reversal → correction
  await sql`
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id           UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
      currency     wallet_currency  NOT NULL,
      amount       NUMERIC(14, 2)   NOT NULL CHECK (amount > 0),
      direction    wallet_direction NOT NULL,
      reason       wallet_reason    NOT NULL,
      reference_id UUID             NOT NULL,
      corrects_id  UUID             REFERENCES wallet_transactions(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW()
    )
  `;

  // ── Currency Conversions (EGP ↔ USD) ────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS currency_conversions (
      id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      egp_amount    NUMERIC(14, 2) NOT NULL CHECK (egp_amount > 0),
      usd_amount    NUMERIC(14, 2) NOT NULL CHECK (usd_amount > 0),
      exchange_rate NUMERIC(10, 4) NOT NULL CHECK (exchange_rate > 0),
      notes         TEXT,
      converted_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── Suppliers ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS suppliers (
      id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) UNIQUE,
      phone      VARCHAR(50),
      address    TEXT,
      city       VARCHAR(100),
      country    VARCHAR(100),
      notes      TEXT,
      created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  // ── Orders (us → supplier, USD) ──────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      supplier_id UUID           REFERENCES suppliers(id) ON DELETE SET NULL,
      total_usd   NUMERIC(14, 2) NOT NULL CHECK (total_usd > 0),
      status      order_status   NOT NULL DEFAULT 'draft',
      notes       TEXT,
      order_date  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── Order Instalments (scheduled payment expectations) ───────
  await sql`
    CREATE TABLE IF NOT EXISTS order_instalments (
      id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id          UUID                    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      instalment_number INT                     NOT NULL CHECK (instalment_number > 0),
      amount_due        NUMERIC(14, 2)          NOT NULL CHECK (amount_due > 0),
      amount_paid       NUMERIC(14, 2)          NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
      amount_remaining  NUMERIC(14, 2)          NOT NULL DEFAULT 0.00 CHECK (amount_remaining >= 0),
      due_date          DATE,
      status            order_instalment_status NOT NULL DEFAULT 'pending',
      notes             TEXT,
      created_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, instalment_number),
      CONSTRAINT order_instalment_paid_cap        CHECK (amount_paid <= amount_due),
      CONSTRAINT order_instalment_remaining_check CHECK (amount_remaining = amount_due - amount_paid)
    )
  `;

  // ── Order Items (snapshot of what was ordered) ───────────────
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id           UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id     UUID           NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
      product_id   UUID           REFERENCES products(id)          ON DELETE SET NULL,
      product_name VARCHAR(255)   NOT NULL,
      unit_price   NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0),
      quantity     INT            NOT NULL CHECK (quantity > 0),
      line_total   NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0)
    )
  `;

  // ── Order Payments (actual money sent to supplier, USD) ───────
  await sql`
    CREATE TABLE IF NOT EXISTS order_payments (
      id             UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id       UUID           NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
      amount_usd     NUMERIC(14, 2) NOT NULL CHECK (amount_usd > 0),
      payment_method payment_method NOT NULL,
      reference      VARCHAR(255),
      notes          TEXT,
      paid_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── Order Payment Instalments (allocation junction) ───────────
  await sql`
    CREATE TABLE IF NOT EXISTS order_payment_instalments (
      id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_payment_id UUID           NOT NULL REFERENCES order_payments(id)    ON DELETE CASCADE,
      instalment_id    UUID           NOT NULL REFERENCES order_instalments(id) ON DELETE RESTRICT,
      amount_allocated NUMERIC(14, 2) NOT NULL CHECK (amount_allocated > 0),
      UNIQUE (order_payment_id, instalment_id)
    )
  `;

  // ── Expenses (EGP outflows) ───────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS expenses (
      id            UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
      category      VARCHAR(100)       NOT NULL,
      recurrence    expense_recurrence NOT NULL DEFAULT 'once',
      amount_egp    NUMERIC(14, 2)     NOT NULL CHECK (amount_egp > 0),
      description   TEXT,
      expense_date  DATE               NOT NULL DEFAULT CURRENT_DATE,
      next_due_date DATE,
      is_active     BOOLEAN            NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
    )
  `;

  console.log("  ✓ Financial tables");

  // ════════════════════════════════════════════════════════════
  // INDEXES
  // ════════════════════════════════════════════════════════════

  // — Core —
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id      ON invoices(customer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_created_by       ON invoices(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoices_status           ON invoices(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice     ON invoice_items(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_invoice_items_product     ON invoice_items(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_invoice      ON installments(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_status       ON installments(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_installments_due_date     ON installments(due_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_payments_invoice          ON payments(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pay_inst_payment          ON payment_installments(payment_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pay_inst_installment      ON payment_installments(installment_id)`;

  // — Financial —
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_reference        ON wallet_transactions(reference_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_corrects         ON wallet_transactions(corrects_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_wallet_tx_created          ON wallet_transactions(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_supplier            ON orders(supplier_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_instalments_order    ON order_instalments(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_order         ON order_items(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_items_product       ON order_items(product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_payments_order       ON order_payments(order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_pay_inst_payment     ON order_payment_instalments(order_payment_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_order_pay_inst_instalment  ON order_payment_instalments(instalment_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_date              ON expenses(expense_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_expenses_recurrence        ON expenses(recurrence)`;

  console.log("  ✓ Indexes");

  // ════════════════════════════════════════════════════════════
  // FUNCTIONS & TRIGGERS
  // ════════════════════════════════════════════════════════════

  // ── updated_at helper ───────────────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$
  `;

  for (const table of [
    "users", "customers", "products", "invoices", "installments",
    "suppliers", "orders", "order_instalments",
  ]) {
    await sql.unsafe(`
      CREATE OR REPLACE TRIGGER trg_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at()
    `);
  }

  // ── Default installment on invoice insert ────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION create_default_installment()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO installments (
        invoice_id, installment_number,
        amount_due, amount_paid, amount_remaining,
        due_date, status
      ) VALUES (
        NEW.id, 1, NEW.total, 0, NEW.total, NEW.due_date, 'pending'
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

  // ── Default instalment on order insert ───────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION create_default_order_instalment()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO order_instalments (
        order_id, instalment_number,
        amount_due, amount_paid, amount_remaining, status
      ) VALUES (
        NEW.id, 1, NEW.total_usd, 0, NEW.total_usd, 'pending'
      );
      RETURN NEW;
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_order_default_instalment
      AFTER INSERT ON orders
      FOR EACH ROW EXECUTE FUNCTION create_default_order_instalment()
  `;

  // ── installments_balanced helper ────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION installments_balanced(p_invoice_id UUID)
    RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
      SELECT COALESCE(SUM(amount_due), 0) = (SELECT total FROM invoices WHERE id = p_invoice_id)
      FROM installments WHERE invoice_id = p_invoice_id;
    $$
  `;

  // ── Stock: deduct on invoice_item insert ─────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION update_stock_on_item_insert()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.product_id IS NOT NULL THEN
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
      END IF;
      RETURN NEW;
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_item_insert
      AFTER INSERT ON invoice_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_item_insert()
  `;

  // ── Stock: adjust on invoice_item update ─────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION update_stock_on_item_update()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.product_id IS NOT NULL AND NEW.quantity <> OLD.quantity THEN
        UPDATE products SET stock_quantity = stock_quantity - (NEW.quantity - OLD.quantity) WHERE id = NEW.product_id;
      END IF;
      RETURN NEW;
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_item_update
      AFTER UPDATE ON invoice_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_item_update()
  `;

  // ── Stock: restore on invoice_item delete ────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION update_stock_on_item_delete()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.product_id IS NOT NULL THEN
        UPDATE products SET stock_quantity = stock_quantity + OLD.quantity WHERE id = OLD.product_id;
      END IF;
      RETURN OLD;
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_item_delete
      AFTER DELETE ON invoice_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_item_delete()
  `;

  // ── Stock: increment on order status → stored ───────────────
  // Fires when order status changes TO stored — adds stock.
  // Fires when status changes AWAY from stored — reverses the increment.
  await sql`
    CREATE OR REPLACE FUNCTION update_stock_on_order_status()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      -- Status moved INTO stored → increment stock
      IF OLD.status <> 'stored' AND NEW.status = 'stored' THEN
        UPDATE products p
        SET stock_quantity = stock_quantity + oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
      END IF;

      -- Status moved OUT of stored → reverse the increment
      IF OLD.status = 'stored' AND NEW.status <> 'stored' THEN
        UPDATE products p
        SET stock_quantity = stock_quantity - oi.quantity
        FROM order_items oi
        WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
      END IF;

      RETURN NEW;
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_order_status
      AFTER UPDATE OF status ON orders
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_order_status()
  `;

  // ── Stock: order_items INSERT/UPDATE/DELETE (only when order is stored) ──
  // Mirrors invoice stock triggers but only affects stock when order.status = stored.
  await sql`
    CREATE OR REPLACE FUNCTION update_stock_on_order_item_change()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    DECLARE
      v_status TEXT;
    BEGIN
      SELECT status::TEXT INTO v_status
      FROM orders WHERE id = COALESCE(NEW.order_id, OLD.order_id);

      -- Only touch stock if the order is already stored
      IF v_status <> 'stored' THEN
        RETURN COALESCE(NEW, OLD);
      END IF;

      IF TG_OP = 'INSERT' THEN
        IF NEW.product_id IS NOT NULL THEN
          UPDATE products SET stock_quantity = stock_quantity + NEW.quantity
          WHERE id = NEW.product_id;
        END IF;

      ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.product_id IS NOT NULL AND NEW.quantity <> OLD.quantity THEN
          UPDATE products SET stock_quantity = stock_quantity + (NEW.quantity - OLD.quantity)
          WHERE id = NEW.product_id;
        END IF;

      ELSIF TG_OP = 'DELETE' THEN
        IF OLD.product_id IS NOT NULL THEN
          UPDATE products SET stock_quantity = stock_quantity - OLD.quantity
          WHERE id = OLD.product_id;
        END IF;
      END IF;

      RETURN COALESCE(NEW, OLD);
    END;
    $$
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_order_item_insert
      AFTER INSERT ON order_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_order_item_change()
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_order_item_update
      AFTER UPDATE ON order_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_order_item_change()
  `;
  await sql`
    CREATE OR REPLACE TRIGGER trg_stock_on_order_item_delete
      AFTER DELETE ON order_items
      FOR EACH ROW EXECUTE FUNCTION update_stock_on_order_item_change()
  `;

  // ── Wallet: invoice payments (EGP in on INSERT, EGP out on DELETE) ──
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
  await sql`DROP TRIGGER IF EXISTS trg_payment_sync_wallet ON payments`;
  await sql`
    CREATE TRIGGER trg_payment_sync_wallet
      AFTER INSERT OR DELETE ON payments
      FOR EACH ROW EXECUTE FUNCTION fn_payment_sync_wallet()
  `;

  // ── Wallet: currency conversions (EGP out + USD in) ──────────
  await sql`
    CREATE OR REPLACE FUNCTION fn_conversion_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
      VALUES ('EGP', NEW.egp_amount, 'out', 'conversion', NEW.id, NEW.converted_at);
      INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
      VALUES ('USD', NEW.usd_amount, 'in',  'conversion', NEW.id, NEW.converted_at);
      UPDATE company_wallet
      SET egp_balance = egp_balance - NEW.egp_amount,
          usd_balance = usd_balance + NEW.usd_amount,
          updated_at  = NOW();
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

  // ── Wallet: expenses (EGP out on INSERT) ─────────────────────
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
  await sql`DROP TRIGGER IF EXISTS trg_expense_sync_wallet ON expenses`;
  await sql`
    CREATE TRIGGER trg_expense_sync_wallet
      AFTER INSERT ON expenses
      FOR EACH ROW EXECUTE FUNCTION fn_expense_sync_wallet()
  `;

  // ── Wallet: order payments (USD out on INSERT, USD in on DELETE) ──
  await sql`
    CREATE OR REPLACE FUNCTION fn_order_payment_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
        VALUES ('USD', NEW.amount_usd, 'out', 'order_payment', NEW.id, NEW.paid_at);
        UPDATE company_wallet SET usd_balance = usd_balance - NEW.amount_usd, updated_at = NOW();
      ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, created_at)
        VALUES ('USD', OLD.amount_usd, 'in', 'order_payment', OLD.id, NOW());
        UPDATE company_wallet SET usd_balance = usd_balance + OLD.amount_usd, updated_at = NOW();
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

  console.log("  ✓ Functions & triggers");
  console.log("✅  Schema created.");
  await sql.end();
}

schema().catch((err) => {
  console.error("❌  Schema creation failed:", err);
  process.exit(1);
});