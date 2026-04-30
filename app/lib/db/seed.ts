import { config } from "dotenv";
config({ path: ".env" });

import sql from "../db";
import { createUser } from "./users";
import { createCustomer } from "./customers";
import { createProduct } from "./products";
import { createInvoice, updateInvoiceStatus } from "./invoices";
import { getInstallmentsByInvoice, splitInstallment } from "./installments";
import { createPayment } from "./payments";

async function seed() {
  console.log("🌱 Seeding database...");

  // ── Users ─────────────────────────────────────────────────
  console.log("  → users");
  const admin   = await createUser({ name: "Alice Weber",   email: "alice@dashboard.dev", password: "hashed_pw_alice", role: "admin"   });
  const manager = await createUser({ name: "Bruno Meier",   email: "bruno@dashboard.dev", password: "hashed_pw_bruno", role: "manager" });
  const staff   = await createUser({ name: "Clara Schmidt", email: "clara@dashboard.dev", password: "hashed_pw_clara", role: "staff"   });

  // ── Customers ─────────────────────────────────────────────
  console.log("  → customers");
  const acme     = await createCustomer({ name: "Acme Corp",        email: "billing@acme.com",       phone: "+49 30 1234567", address: "Unter den Linden 1",  city: "Berlin",   country: "Germany"     });
  const globex   = await createCustomer({ name: "Globex GmbH",      email: "finance@globex.de",      phone: "+49 89 9876543", address: "Maximilianstraße 10", city: "Munich",   country: "Germany"     });
  const initech  = await createCustomer({ name: "Initech AG",       email: "accounts@initech.ch",    phone: "+41 44 5556677", address: "Bahnhofstrasse 42",   city: "Zurich",   country: "Switzerland" });
  const umbrella = await createCustomer({ name: "Umbrella GmbH",    email: "ap@umbrella.de",         phone: "+49 40 1122334", address: "Alsterufer 27",       city: "Hamburg",  country: "Germany"     });
  const stark    = await createCustomer({ name: "Stark Industries",  email: "payments@stark-ind.com", phone: "+1 212 9998877", address: "200 Park Avenue",     city: "New York", country: "USA"         });

  // ── Products ──────────────────────────────────────────────
  console.log("  → products");
  const laptop   = await createProduct({ name: 'Business Laptop 15"',   description: "Intel i7, 16GB RAM, 512GB SSD",     sku: "LAP-001", price: 1299.99, stock_quantity: 25  });
  const monitor  = await createProduct({ name: '4K Monitor 27"',        description: "UHD IPS panel, USB-C, 60Hz",        sku: "MON-001", price: 649.00,  stock_quantity: 40  });
  const keyboard = await createProduct({ name: "Mechanical Keyboard",   description: "Tenkeyless, Cherry MX Brown",       sku: "KEY-001", price: 129.00,  stock_quantity: 80  });
  const mouse    = await createProduct({ name: "Wireless Mouse",        description: "Ergonomic, 2.4GHz, 1 year battery", sku: "MOU-001", price: 49.99,   stock_quantity: 120 });
  const docking  = await createProduct({ name: "USB-C Docking Station", description: "10-in-1, 100W PD, dual HDMI",      sku: "DOC-001", price: 199.00,  stock_quantity: 35  });
  const headset  = await createProduct({ name: "Noise-Cancel Headset",  description: "Over-ear, Bluetooth 5.2, ANC",     sku: "HEA-001", price: 249.00,  stock_quantity: 50  });
  const webcam   = await createProduct({ name: "HD Webcam 1080p",       description: "Auto-focus, built-in mic, USB-A",  sku: "WEB-001", price: 89.00,   stock_quantity: 60  });
  const ssd      = await createProduct({ name: "Portable SSD 1TB",      description: "USB 3.2 Gen2, 1050MB/s read",      sku: "SSD-001", price: 109.99,  stock_quantity: 75  });

  // ── Invoices ──────────────────────────────────────────────
  // console.log("  → invoices & invoice_items");

  // // Invoice 1 — Acme Corp, paid in full, 10% discount
  // const invoice1 = await createInvoice({
  //   customer_id:    acme.id,
  //   created_by:     admin.id,
  //   discount_type:  "percentage",
  //   discount_value: 10,
  //   due_date:       new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  //   notes:          "Workstation setup for new Berlin office",
  //   items: [
  //     { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 2 },
  //     { product_id: monitor.id,  product_name: monitor.name,  unit_price: 649.00,  quantity: 2 },
  //     { product_id: keyboard.id, product_name: keyboard.name, unit_price: 129.00,  quantity: 2 },
  //   ],
  // });

  // // Invoice 2 — Globex, sent, €100 flat discount — split into 2 installments
  // const invoice2 = await createInvoice({
  //   customer_id:    globex.id,
  //   created_by:     manager.id,
  //   discount_type:  "amount",
  //   discount_value: 100,
  //   due_date:       new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
  //   items: [
  //     { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 1 },
  //     { product_id: docking.id, product_name: docking.name, unit_price: 199.00,  quantity: 1 },
  //     { product_id: headset.id, product_name: headset.name, unit_price: 249.00,  quantity: 1 },
  //   ],
  // });

  // // Invoice 3 — Initech, draft, no discount
  // await createInvoice({
  //   customer_id: initech.id,
  //   created_by:  staff.id,
  //   due_date:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  //   notes:       "Q2 peripherals order",
  //   items: [
  //     { product_id: mouse.id,  product_name: mouse.name,  unit_price: 49.99,  quantity: 5 },
  //     { product_id: webcam.id, product_name: webcam.name, unit_price: 89.00,  quantity: 3 },
  //     { product_id: ssd.id,    product_name: ssd.name,    unit_price: 109.99, quantity: 2 },
  //   ],
  // });

  // // Invoice 4 — Umbrella, overdue, 5% discount, partial payment
  // const invoice4 = await createInvoice({
  //   customer_id:    umbrella.id,
  //   created_by:     admin.id,
  //   discount_type:  "percentage",
  //   discount_value: 5,
  //   due_date:       new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  //   items: [
  //     { product_id: laptop.id,  product_name: laptop.name,  unit_price: 1299.99, quantity: 3 },
  //     { product_id: monitor.id, product_name: monitor.name, unit_price: 649.00,  quantity: 3 },
  //   ],
  // });

  // // Invoice 5 — Stark Industries, sent, no discount — split into 3 installments
  // const invoice5 = await createInvoice({
  //   customer_id: stark.id,
  //   created_by:  manager.id,
  //   due_date:    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
  //   notes:       "Full team workstation rollout — 5 seats",
  //   items: [
  //     { product_id: laptop.id,   product_name: laptop.name,   unit_price: 1299.99, quantity: 5 },
  //     { product_id: docking.id,  product_name: docking.name,  unit_price: 199.00,  quantity: 5 },
  //     { product_id: headset.id,  product_name: headset.name,  unit_price: 249.00,  quantity: 5 },
  //     { product_id: keyboard.id, product_name: keyboard.name, unit_price: 129.00,  quantity: 5 },
  //   ],
  // });

  // // ── Installments (custom splits) ──────────────────────────
  // console.log("  → installments (custom splits)");

  // // Split invoice2's single installment 50/50 into 2
  // const [inv2Inst] = await getInstallmentsByInvoice(invoice2.id);
  // await splitInstallment(
  //   inv2Inst.id,
  //   Number((Number(inv2Inst.amount_due) * 0.5).toFixed(2)),
  //   new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  // );

  // // Split invoice5 into 3 equal parts — two consecutive splits from the front
  // const [inv5Inst] = await getInstallmentsByInvoice(invoice5.id);
  // const inv5Part   = Number((Number(inv5Inst.amount_due) / 3).toFixed(2));

  // // First split: [full] → [part1, remainder]
  // await splitInstallment(
  //   inv5Inst.id,
  //   inv5Part,
  //   new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
  // );

  // // Second split: split the remainder → [part2, part3]
  // const inv5Installments = await getInstallmentsByInvoice(invoice5.id);
  // const inv5Remainder    = inv5Installments[1];
  // await splitInstallment(
  //   inv5Remainder.id,
  //   inv5Part,
  //   new Date(Date.now() + 40 * 24 * 60 * 60 * 1000)
  // );

  // // ── Payments ──────────────────────────────────────────────
  // console.log("  → payments & payment_installments");

  // // Invoice 1 — paid in full via single payment
  // const [inst1] = await getInstallmentsByInvoice(invoice1.id);
  // await createPayment({
  //   invoice_id:     invoice1.id,
  //   amount:         Number(inst1.amount_due),
  //   payment_method: "bank_transfer",
  //   reference:      "TXN-2024-001",
  //   paid_at:        new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
  //   allocations: [
  //     { installment_id: inst1.id, amount_allocated: Number(inst1.amount_due) },
  //   ],
  // });
  // // createPayment sets invoice to 'paid' automatically; re-confirm status
  // // await updateInvoiceStatus(invoice1.id, "paid");

  // // Invoice 4 — 40% partial payment against the overdue installment
  // const [inst4] = await getInstallmentsByInvoice(invoice4.id);
  // const partialAmount = Number((Number(inst4.amount_due) * 0.4).toFixed(2));
  // await createPayment({
  //   invoice_id:     invoice4.id,
  //   amount:         partialAmount,
  //   payment_method: "bank_transfer",
  //   reference:      "TXN-2024-002",
  //   paid_at:        new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  //   allocations: [
  //     { installment_id: inst4.id, amount_allocated: partialAmount },
  //   ],
  // });
  // await updateInvoiceStatus(invoice4.id, "overdue");

  console.log("✅  Seed complete.");
  await sql.end();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});