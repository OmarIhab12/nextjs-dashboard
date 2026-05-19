// app/lib/db/seed-vinslon.ts
// Seed for databases initialized with schema-vinslon.ts.
// Self-contained: uses its own postgres connection (prepare: false) so it is
// safe to run immediately after drop-vinslon.ts + schema-vinslon.ts without
// hitting stale type-OID errors from connection-pool caching.
//
// Wallet operations are ordered so no balance ever goes negative:
//   Step A  Invoice payments  → EGP in  (~7 897 EGP)
//   Step B  EGP→RMB conversion           (−4 000 EGP / +570 RMB)
//   Step C  Order payments    → RMB out  (−500 RMB)
//   Step D  Expenses          → EGP out  (−3 450 EGP)
//
// Run with: npx tsx app/lib/db/seed-vinslon.ts

import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';
import bcrypt    from 'bcrypt';

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', prepare: false });

const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 24 * 60 * 60 * 1000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeInvoiceTotals(
  items:         { unit_price: number; quantity: number }[],
  discountType:  'percentage' | 'amount' | undefined,
  discountValue: number | undefined,
) {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  let discountAmount = 0;
  if (discountType === 'percentage' && discountValue)
    discountAmount = (subtotal * discountValue) / 100;
  else if (discountType === 'amount' && discountValue)
    discountAmount = Math.min(discountValue, subtotal);
  return { subtotal, discountAmount, total: subtotal - discountAmount };
}

async function createInvoice(input: {
  customer_id:    string;
  created_by:     string;
  items:          { product_id: string; product_name: string; unit_price: number; quantity: number }[];
  discount_type?: 'percentage' | 'amount';
  discount_value?: number;
  due_date?:      Date;
  notes?:         string;
}): Promise<{ id: string; total: number }> {
  const { subtotal, discountAmount, total } = computeInvoiceTotals(
    input.items, input.discount_type, input.discount_value,
  );
  return sql.begin(async (tx) => {
    const [inv] = await tx<{ id: string }[]>`
      INSERT INTO invoices (
        customer_id, created_by,
        discount_type, discount_value,
        subtotal, discount_amount, total,
        due_date, notes
      ) VALUES (
        ${input.customer_id}, ${input.created_by},
        ${input.discount_type  ?? 'percentage'}, ${input.discount_value ?? 0},
        ${subtotal}, ${discountAmount}, ${total},
        ${input.due_date ?? null}, ${input.notes ?? null}
      )
      RETURNING id
    `;
    await Promise.all(input.items.map((item) => tx`
      INSERT INTO invoice_items (invoice_id, product_id, product_name, unit_price, quantity, line_total)
      VALUES (${inv.id}, ${item.product_id}, ${item.product_name}, ${item.unit_price}, ${item.quantity}, ${item.unit_price * item.quantity})
    `));
    return { id: inv.id, total };
  });
}

async function splitInstallment(id: string, firstAmount: number, secondDueDate?: Date) {
  return sql.begin(async (tx) => {
    const [orig] = await tx<{ id: string; invoice_id: string; installment_number: number; amount_due: string }[]>`
      SELECT * FROM installments WHERE id = ${id}
    `;
    const secondAmount = Number(orig.amount_due) - firstAmount;
    await tx`UPDATE installments SET amount_due = ${firstAmount}, amount_remaining = ${firstAmount} WHERE id = ${id}`;
    await tx`UPDATE installments SET installment_number = installment_number + 1
             WHERE invoice_id = ${orig.invoice_id} AND installment_number > ${orig.installment_number}`;
    await tx`
      INSERT INTO installments (invoice_id, installment_number, amount_due, amount_paid, amount_remaining, due_date)
      VALUES (${orig.invoice_id}, ${orig.installment_number + 1}, ${secondAmount}, 0, ${secondAmount}, ${secondDueDate ?? null})
    `;
  });
}

async function createPayment(input: {
  invoice_id:     string;
  amount:         number;
  payment_method: string;
  reference?:     string;
  paid_at?:       Date;
  allocations:    { installment_id: string; amount_allocated: number }[];
}): Promise<string> {
  return sql.begin(async (tx) => {
    const [pay] = await tx<{ id: string }[]>`
      INSERT INTO payments (invoice_id, amount, payment_method, reference, paid_at)
      VALUES (${input.invoice_id}, ${input.amount}, ${input.payment_method}, ${input.reference ?? null}, ${input.paid_at ?? new Date()})
      RETURNING id
    `;
    await Promise.all(input.allocations.map(async (a) => {
      await tx`INSERT INTO payment_installments (payment_id, installment_id, amount_allocated)
               VALUES (${pay.id}, ${a.installment_id}, ${a.amount_allocated})`;
      await tx`UPDATE installments SET amount_paid = amount_paid + ${a.amount_allocated},
               amount_remaining = amount_remaining - ${a.amount_allocated} WHERE id = ${a.installment_id}`;
    }));
    return pay.id;
  });
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding database...');

  // ════════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════════
  console.log('  → users');
  const [admin] = await sql<{ id: string }[]>`
    INSERT INTO users (name, email, password, role)
    VALUES ('Alice Weber', 'alice@dashboard.dev', ${await bcrypt.hash('password123', 10)}, 'admin')
    RETURNING id
  `;
  const [manager] = await sql<{ id: string }[]>`
    INSERT INTO users (name, email, password, role)
    VALUES ('Bruno Meier', 'bruno@dashboard.dev', ${await bcrypt.hash('password123', 10)}, 'manager')
    RETURNING id
  `;
  const [staff] = await sql<{ id: string }[]>`
    INSERT INTO users (name, email, password, role)
    VALUES ('Clara Schmidt', 'clara@dashboard.dev', ${await bcrypt.hash('password123', 10)}, 'staff')
    RETURNING id
  `;

  // ════════════════════════════════════════════════════════════
  // CUSTOMERS
  // ════════════════════════════════════════════════════════════
  console.log('  → customers');
  const [acme] = await sql<{ id: string }[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES ('Acme Corp', 'billing@acme.com', '+49 30 1234567', 'Unter den Linden 1', 'Berlin', 'Germany')
    RETURNING id
  `;
  const [globex] = await sql<{ id: string }[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES ('Globex GmbH', 'finance@globex.de', '+49 89 9876543', 'Maximilianstraße 10', 'Munich', 'Germany')
    RETURNING id
  `;
  const [initech] = await sql<{ id: string }[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES ('Initech AG', 'accounts@initech.ch', '+41 44 5556677', 'Bahnhofstrasse 42', 'Zurich', 'Switzerland')
    RETURNING id
  `;
  const [umbrella] = await sql<{ id: string }[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES ('Umbrella GmbH', 'ap@umbrella.de', '+49 40 1122334', 'Alsterufer 27', 'Hamburg', 'Germany')
    RETURNING id
  `;
  const [stark] = await sql<{ id: string }[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES ('Stark Industries', 'payments@stark-ind.com', '+1 212 9998877', '200 Park Avenue', 'New York', 'USA')
    RETURNING id
  `;

  // ════════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════════
  console.log('  → products');
  const [laptop] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('Business Laptop 15"', 'Intel i7, 16GB RAM, 512GB SSD', 'LAP-001', 1299.99, 25)
    RETURNING id, name
  `;
  const [monitor] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('4K Monitor 27"', 'UHD IPS panel, USB-C, 60Hz', 'MON-001', 649.00, 40)
    RETURNING id, name
  `;
  const [keyboard] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('Mechanical Keyboard', 'Tenkeyless, Cherry MX Brown', 'KEY-001', 129.00, 80)
    RETURNING id, name
  `;
  const [mouse] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('Wireless Mouse', 'Ergonomic, 2.4GHz, 1 year battery', 'MOU-001', 49.99, 120)
    RETURNING id, name
  `;
  const [docking] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('USB-C Docking Station', '10-in-1, 100W PD, dual HDMI', 'DOC-001', 199.00, 35)
    RETURNING id, name
  `;
  const [headset] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('Noise-Cancel Headset', 'Over-ear, Bluetooth 5.2, ANC', 'HEA-001', 249.00, 50)
    RETURNING id, name
  `;
  const [webcam] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('HD Webcam 1080p', 'Auto-focus, built-in mic, USB-A', 'WEB-001', 89.00, 60)
    RETURNING id, name
  `;
  const [ssd] = await sql<{ id: string; name: string }[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity)
    VALUES ('Portable SSD 1TB', 'USB 3.2 Gen2, 1050MB/s read', 'SSD-001', 109.99, 75)
    RETURNING id, name
  `;

  // ════════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════════
  console.log('  → invoices & invoice_items');

  // Invoice 1 — Acme, confirmed, 10% off
  // subtotal 4155.98 − 10% = total 3740.38
  const invoice1 = await createInvoice({
    customer_id: acme.id, created_by: admin.id,
    discount_type: 'percentage', discount_value: 10,
    due_date: daysFromNow(-30),
    notes: 'Workstation setup for new Berlin office',
    items: [
      { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 2 },
      { product_id: monitor.id,  product_name: monitor.name,  unit_price:  649.00, quantity: 2 },
      { product_id: keyboard.id, product_name: keyboard.name, unit_price:  129.00, quantity: 2 },
    ],
  });

  // Invoice 2 — Globex, 100 flat off, split 50/50
  // subtotal 1747.99 − 100 = total 1647.99  →  inst1 824.00 / inst2 823.99
  const invoice2 = await createInvoice({
    customer_id: globex.id, created_by: manager.id,
    discount_type: 'amount', discount_value: 100,
    due_date: daysFromNow(15),
    items: [
      { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 1 },
      { product_id: docking.id, product_name: docking.name, unit_price:  199.00, quantity: 1 },
      { product_id: headset.id, product_name: headset.name, unit_price:  249.00, quantity: 1 },
    ],
  });

  // Invoice 3 — Initech, draft, unpaid
  await createInvoice({
    customer_id: initech.id, created_by: staff.id,
    due_date: daysFromNow(30),
    notes: 'Q2 peripherals order',
    items: [
      { product_id: mouse.id,  product_name: mouse.name,  unit_price:  49.99, quantity: 5 },
      { product_id: webcam.id, product_name: webcam.name, unit_price:  89.00, quantity: 3 },
      { product_id: ssd.id,    product_name: ssd.name,    unit_price: 109.99, quantity: 2 },
    ],
  });

  // Invoice 4 — Umbrella, 5% off, overdue
  // subtotal 5846.97 − 5% = total 5554.62
  const invoice4 = await createInvoice({
    customer_id: umbrella.id, created_by: admin.id,
    discount_type: 'percentage', discount_value: 5,
    due_date: daysFromNow(-10),
    items: [
      { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 3 },
      { product_id: monitor.id, product_name: monitor.name, unit_price:  649.00, quantity: 3 },
    ],
  });

  // Invoice 5 — Stark, no discount, split 3 ways
  // total 9384.95
  const invoice5 = await createInvoice({
    customer_id: stark.id, created_by: manager.id,
    due_date: daysFromNow(60),
    notes: 'Full team workstation rollout — 5 seats',
    items: [
      { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 5 },
      { product_id: docking.id,  product_name: docking.name,  unit_price:  199.00, quantity: 5 },
      { product_id: headset.id,  product_name: headset.name,  unit_price:  249.00, quantity: 5 },
      { product_id: keyboard.id, product_name: keyboard.name, unit_price:  129.00, quantity: 5 },
    ],
  });

  // ════════════════════════════════════════════════════════════
  // INSTALLMENT SPLITS
  // ════════════════════════════════════════════════════════════
  console.log('  → installment splits');

  // Invoice 2 — 50 / 50
  const [inv2Inst] = await sql<{ id: string; amount_due: string }[]>`
    SELECT id, amount_due FROM installments WHERE invoice_id = ${invoice2.id} ORDER BY installment_number LIMIT 1
  `;
  await splitInstallment(inv2Inst.id, Number((Number(inv2Inst.amount_due) * 0.5).toFixed(2)), daysFromNow(7));

  // Invoice 5 — 3 equal parts
  const [inv5First] = await sql<{ id: string; amount_due: string }[]>`
    SELECT id, amount_due FROM installments WHERE invoice_id = ${invoice5.id} ORDER BY installment_number LIMIT 1
  `;
  const inv5Part = Number((Number(inv5First.amount_due) / 3).toFixed(2));
  await splitInstallment(inv5First.id, inv5Part, daysFromNow(20));
  const [inv5Second] = await sql<{ id: string }[]>`
    SELECT id FROM installments WHERE invoice_id = ${invoice5.id} ORDER BY installment_number LIMIT 1 OFFSET 1
  `;
  await splitInstallment(inv5Second.id, inv5Part, daysFromNow(40));

  // ════════════════════════════════════════════════════════════
  // STEP A — INVOICE PAYMENTS (EGP in)
  // Builds EGP balance before any money goes out.
  // ════════════════════════════════════════════════════════════
  console.log('  → payments (EGP in)');

  // Invoice 1 — paid in full  (+3 740.38 EGP)
  const [inst1] = await sql<{ id: string; amount_due: string }[]>`
    SELECT id, amount_due FROM installments WHERE invoice_id = ${invoice1.id} LIMIT 1
  `;
  await createPayment({
    invoice_id: invoice1.id, amount: Number(inst1.amount_due),
    payment_method: 'bank_transfer', reference: 'TXN-2024-001', paid_at: daysFromNow(-25),
    allocations: [{ installment_id: inst1.id, amount_allocated: Number(inst1.amount_due) }],
  });

  // Invoice 2 — first installment only  (+824.00 EGP)
  const [inv2First] = await sql<{ id: string; amount_due: string }[]>`
    SELECT id, amount_due FROM installments WHERE invoice_id = ${invoice2.id} ORDER BY installment_number LIMIT 1
  `;
  await createPayment({
    invoice_id: invoice2.id, amount: Number(inv2First.amount_due),
    payment_method: 'cash', reference: 'TXN-2024-002', paid_at: daysFromNow(-5),
    allocations: [{ installment_id: inv2First.id, amount_allocated: Number(inv2First.amount_due) }],
  });

  // Invoice 4 — 60% partial  (+3 332.77 EGP)
  const [inst4] = await sql<{ id: string; amount_due: string }[]>`
    SELECT id, amount_due FROM installments WHERE invoice_id = ${invoice4.id} LIMIT 1
  `;
  const partial4 = Number((Number(inst4.amount_due) * 0.6).toFixed(2));
  await createPayment({
    invoice_id: invoice4.id, amount: partial4,
    payment_method: 'bank_transfer', reference: 'TXN-2024-003', paid_at: daysFromNow(-3),
    allocations: [{ installment_id: inst4.id, amount_allocated: partial4 }],
  });
  // EGP balance now: ~7 897

  // ════════════════════════════════════════════════════════════
  // STEP B — CURRENCY CONVERSIONS (EGP → RMB)
  // Funded entirely by Step A income.
  // ════════════════════════════════════════════════════════════
  console.log('  → currency conversions (EGP → RMB)');

  // −4 000 EGP  / +570 RMB  (rate 1 EGP = 0.1425 RMB)
  await sql`
    INSERT INTO currency_conversions (from_amount, to_amount, exchange_rate, direction, notes, converted_at)
    VALUES (4000.00, 570.00, 0.1425, 'egp_to_rmb', 'Initial RMB reserve for supplier payments', ${daysFromNow(-20)})
  `;
  // EGP balance now: ~3 897  |  RMB balance: 570

  // ════════════════════════════════════════════════════════════
  // SUPPLIERS & ORDERS
  // ════════════════════════════════════════════════════════════
  console.log('  → suppliers');
  await sql`
    INSERT INTO suppliers (name, email, phone, city, country, notes)
    VALUES
      ('AsiaSource Ltd',          'procurement@asiasrc.hk', '+852 5550003',   'Hong Kong',     'China',   'Primary RMB supplier'),
      ('TechParts International', 'orders@techparts.io',    '+1 415 5550001', 'San Francisco', 'USA',     'Secondary hardware supplier'),
      ('EuroComponents GmbH',     'supply@eurocomp.de',     '+49 30 5550002', 'Berlin',        'Germany', 'European components')
  `;

  const [asiaSupplier] = await sql<{ id: string }[]>`SELECT id FROM suppliers WHERE name = 'AsiaSource Ltd'   LIMIT 1`;
  const [euroSupplier] = await sql<{ id: string }[]>`SELECT id FROM suppliers WHERE name = 'EuroComponents GmbH' LIMIT 1`;

  console.log('  → orders, order_items & order_instalments');

  // Order 1 — AsiaSource, arrived  (8 750 RMB)
  const [order1] = await sql<{ id: string }[]>`
    INSERT INTO orders (supplier_id, total_rmb, status, notes, order_date)
    VALUES (${asiaSupplier.id}, 8750.00, 'arrived', 'Q1 laptop batch', ${daysFromNow(-45)})
    RETURNING id
  `;
  await sql`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES
      (${order1.id}, ${laptop.id},   ${laptop.name},   3500.00, 2, 7000.00),
      (${order1.id}, ${keyboard.id}, ${keyboard.name},  350.00, 5, 1750.00)
  `;
  // Replace the auto-created instalment with 3 scheduled ones
  await sql`DELETE FROM order_instalments WHERE order_id = ${order1.id}`;
  await sql`
    INSERT INTO order_instalments (order_id, instalment_number, amount_due, amount_paid, amount_remaining, due_date, status)
    VALUES
      (${order1.id}, 1, 2917.00,  500.00, 2417.00, ${daysFromNow(-30)}, 'partial'),
      (${order1.id}, 2, 2917.00,    0.00, 2917.00, ${daysFromNow(-10)}, 'overdue'),
      (${order1.id}, 3, 2916.00,    0.00, 2916.00, ${daysFromNow(30)},  'pending')
  `;

  // Order 2 — EuroComponents, confirmed  (9 000 RMB)
  const [order2] = await sql<{ id: string }[]>`
    INSERT INTO orders (supplier_id, total_rmb, status, notes, order_date)
    VALUES (${euroSupplier.id}, 9000.00, 'confirmed', 'Monitor batch — 5 units', ${daysFromNow(-10)})
    RETURNING id
  `;
  await sql`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (${order2.id}, ${monitor.id}, ${monitor.name}, 1800.00, 5, 9000.00)
  `;
  await sql`
    UPDATE order_instalments SET amount_due = 9000.00, amount_remaining = 9000.00
    WHERE order_id = ${order2.id}
  `;

  // ════════════════════════════════════════════════════════════
  // STEP C — ORDER PAYMENTS (RMB out)
  // Funded entirely by Step B conversion.
  // ════════════════════════════════════════════════════════════
  console.log('  → order payments (RMB out)');

  const [o1Inst1] = await sql<{ id: string }[]>`
    SELECT id FROM order_instalments WHERE order_id = ${order1.id} AND instalment_number = 1
  `;
  const [orderPayment1] = await sql<{ id: string }[]>`
    INSERT INTO order_payments (order_id, amount_rmb, payment_method, reference, paid_at)
    VALUES (${order1.id}, 500.00, 'bank_transfer', 'RMB-WIRE-2024-001', ${daysFromNow(-28)})
    RETURNING id
  `;
  await sql`
    INSERT INTO order_payment_instalments (order_payment_id, instalment_id, amount_allocated)
    VALUES (${orderPayment1.id}, ${o1Inst1.id}, 500.00)
  `;
  // RMB balance now: 70

  // ════════════════════════════════════════════════════════════
  // STEP D — EXPENSES (multi-currency out)
  // Funded by Step A income minus Step B conversion (≈3 897 EGP left).
  // ════════════════════════════════════════════════════════════
  console.log('  → expenses (multi-currency out)');
  await sql`
    INSERT INTO expenses
      (category, expense_type, recurrence, amount, currency, payment_method, description, expense_date, next_due_date, is_active)
    VALUES
      ('salary', 'payroll',   'monthly', 1000.00, 'EGP', 'bank_transfer', 'Alice Weber — monthly salary',   ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('salary', 'payroll',   'monthly',  800.00, 'EGP', 'bank_transfer', 'Bruno Meier — monthly salary',   ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('salary', 'payroll',   'monthly',  600.00, 'EGP', 'bank_transfer', 'Clara Schmidt — monthly salary', ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('office', 'operating', 'monthly',  700.00, 'EGP', 'bank_transfer', 'Office rent — Cairo HQ',         ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('office', 'operating', 'once',     200.00, 'EGP', 'cash',          'Printer cartridges & paper',     ${daysFromNow(-15)},  NULL,              false),
      ('other',  'other',     'once',     150.00, 'EGP', 'cash',          'Trade show booth — Cairo Expo',  ${daysFromNow(-7)},   NULL,              false)
  `;
  // EGP balance now: ~447

  console.log('\n✅ Seed complete.');
  console.log('   Approximate final wallet:');
  console.log('   EGP ≈ 447  |  RMB = 70  |  USD = 0');
  console.log('   Users: alice / bruno / clara  →  password: password123');

  await sql.end();
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
