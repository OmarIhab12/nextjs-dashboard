import sql from "@/app/lib/db";

async function migrate() {
  // The original trigger refunded the full credit_amount as cash, ignoring
  // whether the customer had actually paid for the returned items. Wallet
  // transactions are now computed and inserted in application code (createReturn)
  // so only the genuine overpaid amount is ever refunded.
  await sql`
    CREATE OR REPLACE FUNCTION fn_return_sync_wallet()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      RETURN NULL;
    END;
    $$
  `;
  console.log("✅  fn_return_sync_wallet neutralized — wallet handled in application code.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
