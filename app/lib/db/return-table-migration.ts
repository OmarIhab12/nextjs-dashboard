import sql from "@/app/lib/db";

async function migrate() {
  console.log("🛠️  Running return table migration...");

  // ── Extend wallet_reason enum ───────────────────────────────
  await sql`ALTER TYPE wallet_reason ADD VALUE IF NOT EXISTS 'customer_refund'`;

  console.log("  ✓ Extended wallet_reason enum");

  // ── returns ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS returns (
      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id      UUID           NOT NULL REFERENCES invoices(id)  ON DELETE RESTRICT,
      created_by      UUID           NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
      credit_amount   NUMERIC(12, 2) NOT NULL CHECK (credit_amount > 0),
      resolution_type TEXT           NOT NULL CHECK (resolution_type IN ('credit', 'cash_refund')),
      reason          TEXT,
      notes           TEXT,
      created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `;

  // ── return_items ─────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS return_items (
      id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
      return_id       UUID           NOT NULL REFERENCES returns(id)       ON DELETE CASCADE,
      invoice_item_id UUID           REFERENCES invoice_items(id)          ON DELETE SET NULL,
      product_id      UUID           REFERENCES products(id)               ON DELETE SET NULL,
      product_name    VARCHAR(255)   NOT NULL,
      unit_price      NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
      quantity        INT            NOT NULL CHECK (quantity > 0),
      line_total      NUMERIC(12, 2) NOT NULL CHECK (line_total >= 0)
    )
  `;

  console.log("  ✓ returns and return_items tables created");

  // ── Wallet trigger: deduct EGP on cash_refund return ─────────
  await sql`
    CREATE OR REPLACE FUNCTION fn_return_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.resolution_type = 'cash_refund' THEN
        INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id)
        VALUES ('EGP', NEW.credit_amount, 'out', 'customer_refund', NEW.id);
        UPDATE company_wallet
        SET egp_balance = egp_balance - NEW.credit_amount,
            updated_at  = NOW();
      END IF;
      RETURN NULL;
    END;
    $$
  `;
  await sql`DROP TRIGGER IF EXISTS trg_return_sync_wallet ON returns`;
  await sql`
    CREATE TRIGGER trg_return_sync_wallet
      AFTER INSERT ON returns
      FOR EACH ROW EXECUTE FUNCTION fn_return_sync_wallet()
  `;

  console.log("  ✓ Wallet trigger for returns created");

  // ── Customer credit balance (unallocated return credits) ─────
  // Tracks excess credit that couldn't be applied to any existing installment.
  // Auto-drained when the customer's next invoice is created.
  await sql`
    ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00
  `;

  console.log("  ✓ customers.credit_balance column added");

  // ── Indexes ───────────────────────────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_returns_invoice      ON returns(invoice_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_return_items_return  ON return_items(return_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id)`;

  console.log("  ✓ Indexes created");
  console.log("✅  Return table migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
