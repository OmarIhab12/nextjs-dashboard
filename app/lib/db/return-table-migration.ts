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

  // No wallet trigger on returns — wallet entries are written in application
  // code (createReturn) so only the genuinely overpaid amount is refunded.

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
