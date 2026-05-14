import { config } from "dotenv";
config({ path: ".env" });

import sql from "../db";
import { createUser }          from "./users";
import { createCustomer }      from "./customers";
import { createProduct }       from "./products";
import { createInvoice }       from "./invoices";
import { getInstallmentsByInvoice, splitInstallment } from "./installments";
import { createPayment }       from "./payments";

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysFromNow = (d: number) =>
  new Date(Date.now() + d * 24 * 60 * 60 * 1000);

async function seed() {
  console.log("🌱 Seeding database...");

  // ════════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════════
  console.log("  → users");
  const admin   = await createUser({ name: "Alice Weber",   email: "alice@dashboard.dev", password: "hashed_pw_alice", role: "admin"   });
  const manager = await createUser({ name: "Bruno Meier",   email: "bruno@dashboard.dev", password: "hashed_pw_bruno", role: "manager" });
  const staff   = await createUser({ name: "Clara Schmidt", email: "clara@dashboard.dev", password: "hashed_pw_clara", role: "staff"   });

  // ════════════════════════════════════════════════════════════
  // CUSTOMERS
  // ════════════════════════════════════════════════════════════
  console.log("  → customers");
  const acme     = await createCustomer({ name: "Acme Corp",       email: "billing@acme.com",       phone: "+49 30 1234567", address: "Unter den Linden 1",  city: "Berlin",   country: "Germany"     });
  const globex   = await createCustomer({ name: "Globex GmbH",     email: "finance@globex.de",      phone: "+49 89 9876543", address: "Maximilianstraße 10", city: "Munich",   country: "Germany"     });
  const initech  = await createCustomer({ name: "Initech AG",      email: "accounts@initech.ch",    phone: "+41 44 5556677", address: "Bahnhofstrasse 42",   city: "Zurich",   country: "Switzerland" });
  const umbrella = await createCustomer({ name: "Umbrella GmbH",   email: "ap@umbrella.de",         phone: "+49 40 1122334", address: "Alsterufer 27",       city: "Hamburg",  country: "Germany"     });
  const stark    = await createCustomer({ name: "Stark Industries", email: "payments@stark-ind.com", phone: "+1 212 9998877", address: "200 Park Avenue",     city: "New York", country: "USA"         });

  // ════════════════════════════════════════════════════════════
  // PRODUCTS
  // ════════════════════════════════════════════════════════════
  console.log("  → products");
  const laptop   = await createProduct({ name: 'Business Laptop 15"',   description: "Intel i7, 16GB RAM, 512GB SSD",     sku: "LAP-001", price: 1299.99, stock_quantity: 25  });
  const monitor  = await createProduct({ name: '4K Monitor 27"',        description: "UHD IPS panel, USB-C, 60Hz",        sku: "MON-001", price: 649.00,  stock_quantity: 40  });
  const keyboard = await createProduct({ name: "Mechanical Keyboard",   description: "Tenkeyless, Cherry MX Brown",       sku: "KEY-001", price: 129.00,  stock_quantity: 80  });
  const mouse    = await createProduct({ name: "Wireless Mouse",        description: "Ergonomic, 2.4GHz, 1 year battery", sku: "MOU-001", price: 49.99,   stock_quantity: 120 });
  const docking  = await createProduct({ name: "USB-C Docking Station", description: "10-in-1, 100W PD, dual HDMI",      sku: "DOC-001", price: 199.00,  stock_quantity: 35  });
  const headset  = await createProduct({ name: "Noise-Cancel Headset",  description: "Over-ear, Bluetooth 5.2, ANC",     sku: "HEA-001", price: 249.00,  stock_quantity: 50  });
  const webcam   = await createProduct({ name: "HD Webcam 1080p",       description: "Auto-focus, built-in mic, USB-A",  sku: "WEB-001", price: 89.00,   stock_quantity: 60  });
  const ssd      = await createProduct({ name: "Portable SSD 1TB",      description: "USB 3.2 Gen2, 1050MB/s read",      sku: "SSD-001", price: 109.99,  stock_quantity: 75  });

  // ════════════════════════════════════════════════════════════
  // INVOICES
  // ════════════════════════════════════════════════════════════
  console.log("  → invoices & invoice_items");

  // Invoice 1 — Acme Corp, confirmed, 10% discount, paid in full
  const invoice1 = await createInvoice({
    customer_id:    acme.id,
    created_by:     admin.id,
    discount_type:  "percentage",
    discount_value: 10,
    due_date:       daysFromNow(-30),
    notes:          "Workstation setup for new Berlin office",
    items: [
      { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 2 },
      { product_id: monitor.id,  product_name: monitor.name,  unit_price: 649.00,  quantity: 2 },
      { product_id: keyboard.id, product_name: keyboard.name, unit_price: 129.00,  quantity: 2 },
    ],
  });

  // Invoice 2 — Globex, confirmed, €100 flat discount, split into 2 installments, partial payment
  const invoice2 = await createInvoice({
    customer_id:    globex.id,
    created_by:     manager.id,
    discount_type:  "amount",
    discount_value: 100,
    due_date:       daysFromNow(15),
    items: [
      { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 1 },
      { product_id: docking.id, product_name: docking.name, unit_price: 199.00,  quantity: 1 },
      { product_id: headset.id, product_name: headset.name, unit_price: 249.00,  quantity: 1 },
    ],
  });

  // Invoice 3 — Initech, draft, no discount
  await createInvoice({
    customer_id: initech.id,
    created_by:  staff.id,
    due_date:    daysFromNow(30),
    notes:       "Q2 peripherals order",
    items: [
      { product_id: mouse.id,  product_name: mouse.name,  unit_price: 49.99,  quantity: 5 },
      { product_id: webcam.id, product_name: webcam.name, unit_price: 89.00,  quantity: 3 },
      { product_id: ssd.id,    product_name: ssd.name,    unit_price: 109.99, quantity: 2 },
    ],
  });

  // Invoice 4 — Umbrella, overdue, 5% discount, partial payment
  const invoice4 = await createInvoice({
    customer_id:    umbrella.id,
    created_by:     admin.id,
    discount_type:  "percentage",
    discount_value: 5,
    due_date:       daysFromNow(-10),
    items: [
      { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 3 },
      { product_id: monitor.id, product_name: monitor.name, unit_price: 649.00,  quantity: 3 },
    ],
  });

  // Invoice 5 — Stark Industries, confirmed, no discount, split into 3 installments
  const invoice5 = await createInvoice({
    customer_id: stark.id,
    created_by:  manager.id,
    due_date:    daysFromNow(60),
    notes:       "Full team workstation rollout — 5 seats",
    items: [
      { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 5 },
      { product_id: docking.id,  product_name: docking.name,  unit_price: 199.00,  quantity: 5 },
      { product_id: headset.id,  product_name: headset.name,  unit_price: 249.00,  quantity: 5 },
      { product_id: keyboard.id, product_name: keyboard.name, unit_price: 129.00,  quantity: 5 },
    ],
  });

  // ════════════════════════════════════════════════════════════
  // INSTALLMENT SPLITS
  // ════════════════════════════════════════════════════════════
  console.log("  → installment splits");

  // Invoice 2 — split 50/50
  const [inv2Inst] = await getInstallmentsByInvoice(invoice2.id);
  await splitInstallment(
    inv2Inst.id,
    Number((Number(inv2Inst.amount_due) * 0.5).toFixed(2)),
    daysFromNow(7),
  );

  // Invoice 5 — split into 3 equal parts
  const [inv5First] = await getInstallmentsByInvoice(invoice5.id);
  const inv5Part = Number((Number(inv5First.amount_due) / 3).toFixed(2));

  await splitInstallment(inv5First.id, inv5Part, daysFromNow(20));

  const inv5Instalments = await getInstallmentsByInvoice(invoice5.id);
  await splitInstallment(inv5Instalments[1].id, inv5Part, daysFromNow(40));

  // ════════════════════════════════════════════════════════════
  // PAYMENTS (customer → us, EGP, triggers wallet)
  // ════════════════════════════════════════════════════════════
  console.log("  → payments");

  // Invoice 1 — paid in full
  const [inst1] = await getInstallmentsByInvoice(invoice1.id);
  await createPayment({
    invoice_id:     invoice1.id,
    amount:         Number(inst1.amount_due),
    payment_method: "bank_transfer",
    reference:      "TXN-2024-001",
    paid_at:        daysFromNow(-25),
    allocations: [{ installment_id: inst1.id, amount_allocated: Number(inst1.amount_due) }],
  });

  // Invoice 2 — pay first installment only
  const inv2Instalments = await getInstallmentsByInvoice(invoice2.id);
  const inv2First = inv2Instalments[0];
  await createPayment({
    invoice_id:     invoice2.id,
    amount:         Number(inv2First.amount_due),
    payment_method: "cash",
    reference:      "TXN-2024-002",
    paid_at:        daysFromNow(-5),
    allocations: [{ installment_id: inv2First.id, amount_allocated: Number(inv2First.amount_due) }],
  });

  // Invoice 4 — 40% partial payment
  const [inst4] = await getInstallmentsByInvoice(invoice4.id);
  const partial4 = Number((Number(inst4.amount_due) * 0.4).toFixed(2));
  await createPayment({
    invoice_id:     invoice4.id,
    amount:         partial4,
    payment_method: "bank_transfer",
    reference:      "TXN-2024-003",
    paid_at:        daysFromNow(-3),
    allocations: [{ installment_id: inst4.id, amount_allocated: partial4 }],
  });

  // ════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ════════════════════════════════════════════════════════════
  console.log("  → suppliers");
  await sql`
    INSERT INTO suppliers (name, email, phone, city, country, notes)
    VALUES
      ('TechParts International', 'orders@techparts.io',   '+1 415 5550001', 'San Francisco', 'USA',     'Main hardware supplier'),
      ('EuroComponents GmbH',    'supply@eurocomp.de',     '+49 30 5550002', 'Berlin',        'Germany', 'European components'),
      ('AsiaSource Ltd',         'procurement@asiasrc.hk', '+852 5550003',   'Hong Kong',     'China',   'Budget peripherals')
  `;

  const [techSupplier] = await sql<{ id: string }[]>`
    SELECT id FROM suppliers WHERE name = 'TechParts International' LIMIT 1
  `;
  const [euroSupplier] = await sql<{ id: string }[]>`
    SELECT id FROM suppliers WHERE name = 'EuroComponents GmbH' LIMIT 1
  `;

  // ════════════════════════════════════════════════════════════
  // ORDERS (us → supplier, USD)
  // ════════════════════════════════════════════════════════════
  console.log("  → orders, order_items & order_instalments");

  // Order 1 — TechParts, arrived, laptops + keyboards
  // total_usd is a placeholder; replaceOrderItems will recompute it
  const [order1] = await sql<{ id: string }[]>`
    INSERT INTO orders (supplier_id, total_usd, status, notes, order_date)
    VALUES (${techSupplier.id}, 1.00, 'arrived', 'Q1 laptop batch', ${daysFromNow(-45)})
    RETURNING id
  `;

  // Insert order items (prices are what we paid the supplier, not retail)
  await sql`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES
      (${order1.id}, ${laptop.id},   ${laptop.name},   950.00, 10, 9500.00),
      (${order1.id}, ${keyboard.id}, ${keyboard.name},  80.00, 20, 1600.00)
  `;

  // Recompute order total from items
  await sql`
    UPDATE orders
    SET total_usd = (SELECT SUM(line_total) FROM order_items WHERE order_id = ${order1.id})
    WHERE id = ${order1.id}
  `;

  // Replace the auto-created single instalment with 3 scheduled ones
  await sql`DELETE FROM order_instalments WHERE order_id = ${order1.id}`;
  await sql`
    INSERT INTO order_instalments
      (order_id, instalment_number, amount_due, amount_paid, amount_remaining, due_date, status)
    VALUES
      (${order1.id}, 1, 3000.00, 3000.00, 0.00,   ${daysFromNow(-30)}, 'paid'),
      (${order1.id}, 2, 4000.00, 0,       4000.00, ${daysFromNow(-10)}, 'overdue'),
      (${order1.id}, 3, 4100.00, 0,       4100.00, ${daysFromNow(30)},  'pending')
  `;

  // Order 2 — EuroComponents, confirmed, monitors only
  const [order2] = await sql<{ id: string }[]>`
    INSERT INTO orders (supplier_id, total_usd, status, notes, order_date)
    VALUES (${euroSupplier.id}, 1.00, 'confirmed', 'Monitor batch — 8 units', ${daysFromNow(-10)})
    RETURNING id
  `;

  await sql`
    INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
    VALUES (${order2.id}, ${monitor.id}, ${monitor.name}, 400.00, 8, 3200.00)
  `;

  await sql`
    UPDATE orders
    SET total_usd = (SELECT SUM(line_total) FROM order_items WHERE order_id = ${order2.id})
    WHERE id = ${order2.id}
  `;

  // Update default instalment for order2 to match real total
  await sql`
    UPDATE order_instalments
    SET amount_due = 3200.00, amount_remaining = 3200.00
    WHERE order_id = ${order2.id}
  `;

  // ════════════════════════════════════════════════════════════
  // ORDER PAYMENTS (us → supplier, USD, triggers wallet)
  // ════════════════════════════════════════════════════════════
  console.log("  → order payments");

  const [o1Inst1] = await sql<{ id: string }[]>`
    SELECT id FROM order_instalments
    WHERE order_id = ${order1.id} AND instalment_number = 1
  `;

  // Payment for instalment 1 (fully paid)
  const [orderPayment1] = await sql<{ id: string }[]>`
    INSERT INTO order_payments (order_id, amount_usd, payment_method, reference, paid_at)
    VALUES (${order1.id}, 3000.00, 'bank_transfer', 'WIRE-2024-001', ${daysFromNow(-28)})
    RETURNING id
  `;

  await sql`
    INSERT INTO order_payment_instalments (order_payment_id, instalment_id, amount_allocated)
    VALUES (${orderPayment1.id}, ${o1Inst1.id}, 3000.00)
  `;

  // ════════════════════════════════════════════════════════════
  // CURRENCY CONVERSIONS (EGP → USD, triggers wallet)
  // ════════════════════════════════════════════════════════════
  console.log("  → currency conversions");
  await sql`
    INSERT INTO currency_conversions (egp_amount, usd_amount, exchange_rate, direction, notes, converted_at)
    VALUES
      (150000.00, 3000.00, 50.0000, 'egp_to_usd', 'Initial USD reserve for supplier orders', ${daysFromNow(-60)}),
      (50000.00,   980.39, 51.0000, 'egp_to_usd', 'Top-up for order2 payment',               ${daysFromNow(-8)})
  `;

  // ════════════════════════════════════════════════════════════
  // EXPENSES (EGP out, triggers wallet)
  // ════════════════════════════════════════════════════════════
  console.log("  → expenses");
  await sql`
    INSERT INTO expenses (category, recurrence, amount_egp, description, expense_date, next_due_date, is_active)
    VALUES
      ('salary', 'monthly', 12000.00, 'Alice Weber — monthly salary',  ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('salary', 'monthly',  9000.00, 'Bruno Meier — monthly salary',  ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('salary', 'monthly',  7000.00, 'Clara Schmidt — monthly salary', ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('office', 'monthly',  4500.00, 'Office rent — Cairo HQ',        ${daysFromNow(-30)}, ${daysFromNow(0)},  true),
      ('office', 'once',      850.00, 'Printer cartridges & paper',    ${daysFromNow(-15)}, NULL,               false),
      ('other',  'once',     2200.00, 'Trade show booth — Cairo Expo', ${daysFromNow(-7)},  NULL,               false)
  `;

  console.log("✅  Seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});