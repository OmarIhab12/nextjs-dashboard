import sql from "../db";
import { PaymentMethod } from "./payments";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  image_url: string;
  city: string | null;
  country: string | null;
  credit_balance: string; // NUMERIC from postgres comes as string
  created_at: Date;
  updated_at: Date;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export type CustomerInvoiceSummary = {
  id: string;
  created_at: Date;
  due_date: Date | null;
  total: string;         // original invoice total
  total_credits: number; // all return credits (credit + cash_refund) — reduces obligation
  cash_refunded: number; // subset of total_credits that was paid back as cash
  paid: number;          // sum of installment payments received from customer
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
};
 
export type CustomerPaymentSummary = {
  id: string;
  amount: string;
  paid_at: Date;
  payment_method: PaymentMethod;
  invoice_ids: string[]; // which invoices this payment was applied to
};
 
export type CustomerPageData = {
  customer:          Customer;
  invoiceSummaries:  CustomerInvoiceSummary[];
  paymentSummaries:  CustomerPaymentSummary[];
  totalOwed:         number; // remaining installments (net of returns)
  totalPaid:         number; // gross payments received from customer
  totalCredits:      number; // all return credits issued
  totalCashRefunded: number; // subset: credits settled as cash back to customer
};

// ── Queries ──────────────────────────────────────────────────

export async function getAllCustomers(): Promise<Customer[]> {
  return sql<Customer[]>`
    SELECT * FROM customers
    ORDER BY name ASC
  `;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const [customer] = await sql<Customer[]>`
    SELECT * FROM customers
    WHERE id = ${id}
  `;
  return customer ?? null;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  return sql<Customer[]>`
    SELECT * FROM customers
    WHERE
      name    ILIKE ${"%" + query + "%"}
      OR email ILIKE ${"%" + query + "%"}
    ORDER BY name ASC
  `;
}

// ── Mutations ────────────────────────────────────────────────

export async function createCustomer(
  input: CreateCustomerInput
): Promise<Customer> {
  const [customer] = await sql<Customer[]>`
    INSERT INTO customers (name, email, phone, address, city, country)
    VALUES (
      ${input.name},
      ${input.email ?? null},
      ${input.phone ?? null},
      ${input.address ?? null},
      ${input.city ?? null},
      ${input.country ?? null}
    )
    RETURNING *
  `;
  return customer;
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<Customer | null> {
  const [customer] = await sql<Customer[]>`
    UPDATE customers
    SET
      name    = COALESCE(${input.name    ?? null}, name),
      email   = COALESCE(${input.email   ?? null}, email),
      phone   = COALESCE(${input.phone   ?? null}, phone),
      address = COALESCE(${input.address ?? null}, address),
      city    = COALESCE(${input.city    ?? null}, city),
      country = COALESCE(${input.country ?? null}, country)
    WHERE id = ${id}
    RETURNING *
  `;
  return customer ?? null;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM customers
    WHERE id = ${id}
  `;
  return result.count > 0;
}

// ── Queries ───────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;
 
export async function fetchFilteredCustomers(
  query: string,
  currentPage: number
): Promise<Customer[]> {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;
 
  return sql<Customer[]>`
    SELECT * FROM customers
    WHERE
      name    ILIKE ${`%${query}%`} OR
      email   ILIKE ${`%${query}%`} OR
      city    ILIKE ${`%${query}%`} OR
      country ILIKE ${`%${query}%`} OR
      address ILIKE ${`%${query}%`}
    ORDER BY created_at DESC
    LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
  `;
}
 
export async function fetchCustomersPages(query: string): Promise<number> {
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*) FROM customers
    WHERE
      name    ILIKE ${`%${query}%`} OR
      email   ILIKE ${`%${query}%`} OR
      city    ILIKE ${`%${query}%`} OR
      country ILIKE ${`%${query}%`} OR
      address ILIKE ${`%${query}%`}
  `;
  return Math.ceil(Number(count) / ITEMS_PER_PAGE);
}


export async function getCustomerPageData(
  customerId: string
): Promise<CustomerPageData | null> {
  // Customer
  const [customer] = await sql<Customer[]>`
    SELECT * FROM customers WHERE id = ${customerId}
  `;
  if (!customer) return null;
 
  // Invoice summaries with computed payment_status and return credits
  const invoiceSummaries = await sql<CustomerInvoiceSummary[]>`
    SELECT
      invoices.id,
      invoices.created_at,
      invoices.due_date,
      invoices.total,
      COALESCE(r.total_credits, 0)  AS total_credits,
      COALESCE(r.cash_refunded, 0)  AS cash_refunded,
      (SELECT SUM(amount_paid) FROM installments WHERE invoice_id = invoices.id) AS paid,
      CASE
        WHEN SUM(installments.amount_due) = SUM(installments.amount_paid)
          THEN 'paid'
        WHEN invoices.due_date < CURRENT_DATE
          AND SUM(installments.amount_paid) < SUM(installments.amount_due)
          THEN 'overdue'
        WHEN SUM(installments.amount_paid) > 0
          AND SUM(installments.amount_paid) < SUM(installments.amount_due)
          THEN 'partial'
        ELSE 'pending'
      END AS payment_status
    FROM invoices
    JOIN installments ON installments.invoice_id = invoices.id
    LEFT JOIN (
      SELECT
        invoice_id,
        SUM(credit_amount) AS total_credits,
        SUM(CASE WHEN resolution_type = 'cash_refund' THEN credit_amount ELSE 0 END) AS cash_refunded
      FROM returns
      GROUP BY invoice_id
    ) r ON r.invoice_id = invoices.id
    WHERE invoices.customer_id = ${customerId}
    GROUP BY invoices.id, invoices.created_at, invoices.due_date, invoices.total, r.total_credits, r.cash_refunded
    ORDER BY invoices.created_at DESC
  `;
 
  // Payment summaries — group allocations per payment
 const paymentSummaries = await sql<CustomerPaymentSummary[]>`
  SELECT
    p.id,
    p.amount,
    p.paid_at,
    p.payment_method,
    ARRAY_AGG(DISTINCT pi.installment_id) AS invoice_ids
  FROM payments p
  LEFT JOIN payment_installments pi ON pi.payment_id = p.id
  WHERE p.customer_id = ${customerId}
     OR p.invoice_id IN (
       SELECT id FROM invoices WHERE customer_id = ${customerId}
     )
  GROUP BY p.id, p.amount, p.paid_at, p.payment_method
  ORDER BY p.paid_at DESC
  `;
 
  // Totals
  const [{ total_owed }] = await sql<{ total_owed: string }[]>`
  SELECT COALESCE(SUM(i.amount_remaining), 0) AS total_owed
  FROM installments i
  JOIN invoices inv ON inv.id = i.invoice_id
  WHERE inv.customer_id = ${customerId}
    AND i.amount_remaining > 0
  `;
  const totalOwed = Number(total_owed);
 
  const totalPaid = paymentSummaries
    .reduce((s, p) => s + Number(p.amount), 0);

  const totalCredits = invoiceSummaries
    .reduce((s, i) => s + Number(i.total_credits), 0);

  const totalCashRefunded = invoiceSummaries
    .reduce((s, i) => s + Number(i.cash_refunded), 0);

  return { customer, invoiceSummaries, paymentSummaries, totalOwed, totalPaid, totalCredits, totalCashRefunded };
}
 
// ── Customer account statement ────────────────────────────────

export type StatementTransaction = {
  event_date: string;   // DD/MM/YYYY
  amount:     number;   // positive = invoice, negative = payment (as stored)
  event_type: 'invoice' | 'payment' | 'return_credit' | 'return_refund' | 'credit_refund';
};

export async function getCustomerStatement(customerId: string): Promise<{
  customer:     Customer | null;
  transactions: StatementTransaction[];
}> {
  const [customer] = await sql<Customer[]>`
    SELECT * FROM customers WHERE id = ${customerId}
  `;
  if (!customer) return { customer: null, transactions: [] };

  const rows = await sql<{ event_date: string; amount: string; event_type: string }[]>`
    SELECT
      TO_CHAR(created_at, 'DD/MM/YYYY') AS event_date,
      total::text                                   AS amount,
      'invoice'                                     AS event_type,
      created_at                                    AS sort_at
    FROM invoices
    WHERE customer_id = ${customerId}

    UNION ALL

    SELECT
      TO_CHAR(p.paid_at, 'DD/MM/YYYY') AS event_date,
      p.amount::text                               AS amount,
      'payment'                                    AS event_type,
      p.paid_at                                    AS sort_at
    FROM payments p
    WHERE p.customer_id = ${customerId}
       OR p.invoice_id IN (
         SELECT id FROM invoices WHERE customer_id = ${customerId}
       )

    UNION ALL

    -- Return obligation lines (reduce what customer owes — applies to all return types)
    SELECT
      TO_CHAR(r.created_at, 'DD/MM/YYYY')   AS event_date,
      r.credit_amount::text                  AS amount,
      'return_credit'                        AS event_type,
      r.created_at                           AS sort_at
    FROM returns r
    JOIN invoices i ON i.id = r.invoice_id
    WHERE i.customer_id = ${customerId}

    UNION ALL

    -- Cash refund lines (money physically given back to customer)
    SELECT
      TO_CHAR(r.created_at, 'DD/MM/YYYY')   AS event_date,
      wt.amount::text                        AS amount,
      'return_refund'                        AS event_type,
      r.created_at                           AS sort_at
    FROM returns r
    JOIN invoices i ON i.id = r.invoice_id
    JOIN wallet_transactions wt
      ON wt.reference_id = r.id
     AND wt.reason = 'customer_refund'
    WHERE i.customer_id = ${customerId}
      AND r.resolution_type = 'cash_refund'

    UNION ALL

    -- Credit balance refunds (cash paid out of the customer's credit_balance,
    -- not tied to a return — each has its own row in credit_refunds)
    SELECT
      TO_CHAR(cr.created_at, 'DD/MM/YYYY') AS event_date,
      cr.amount::text                      AS amount,
      'credit_refund'                      AS event_type,
      cr.created_at                        AS sort_at
    FROM credit_refunds cr
    WHERE cr.customer_id = ${customerId}

    ORDER BY sort_at ASC
  `;

  return {
    customer,
    transactions: rows.map((r) => ({
      event_date: r.event_date,
      amount:     Number(r.amount),
      event_type: r.event_type as 'invoice' | 'payment' | 'return_credit' | 'return_refund' | 'credit_refund',
    })),
  };
}

// ── Auto-allocate payment across oldest unpaid invoices ───────
// Returns the payment record after allocating across installments
export async function addPaymentForCustomer(
  customerId: string,
  amount: number,
  paymentMethod: string,
  createdBy: string,
  reference?: string
): Promise<void> {
  await sql.begin(async (tx) => {
    // Get oldest unpaid/partial installments ordered by due_date
    const installments = await tx`
      SELECT
        i.id,
        i.invoice_id,
        i.amount_remaining
      FROM installments i
      JOIN invoices inv ON inv.id = i.invoice_id
      WHERE inv.customer_id = ${customerId}
        AND i.status != 'paid'
        AND i.amount_remaining > 0
      ORDER BY i.created_at ASC NULLS LAST, i.due_date ASC
    `;
 
    // Anchor the payment to the oldest unpaid invoice when there is one; otherwise
    // it's a pure credit-building payment, anchored to the customer directly so it
    // still shows up in payment history / statements.
    const anchorInvoiceId = installments[0]?.invoice_id ?? null;

    const [payment] = await tx`
      INSERT INTO payments (invoice_id, customer_id, amount, payment_method, reference, created_by)
      VALUES (
        ${anchorInvoiceId},
        ${anchorInvoiceId ? null : customerId},
        ${amount},
        ${paymentMethod}::payment_method,
        ${reference ?? null},
        ${createdBy}
      )
      RETURNING *
    `;

    // Distribute amount across installments oldest-first
    let remaining = amount;

    for (const inst of installments) {
      if (remaining <= 0) break;

      const allocated = Math.min(remaining, Number(inst.amount_remaining));
      remaining = Number((remaining - allocated).toFixed(2));

      // Insert allocation
      await tx`
        INSERT INTO payment_installments (payment_id, installment_id, amount_allocated)
        VALUES (${payment.id}, ${inst.id}, ${allocated})
      `;

      // Update installment — triggers handle stock, DB constraints handle integrity
      await tx`
        UPDATE installments
        SET
          amount_paid      = amount_paid + ${allocated},
          amount_remaining = amount_remaining - ${allocated}
        WHERE id = ${inst.id}
      `;
    }

    // Anything left over after paying off every outstanding installment is excess —
    // credit it to the customer's balance so it auto-applies to their next invoice.
    if (remaining > 0) {
      await tx`
        UPDATE customers
        SET credit_balance = credit_balance + ${remaining.toFixed(2)}
        WHERE id = ${customerId}
      `;
    }
  });
}

// ── Refund cash out of a customer's credit balance ────────────
// Mirrors the cash-refund pattern in returns.ts: the wallet entries are
// written manually here (not via a DB trigger) since the refundable amount
// is caller-supplied and must be capped to the customer's actual balance.
export async function refundCustomerCredit(
  customerId: string,
  amount:     number,
  accountId:  string,
  createdBy:  string,
  notes?:     string,
): Promise<void> {
  await sql.begin(async (tx) => {
    // Atomic guard: only succeeds if enough credit is actually available —
    // avoids a race between two concurrent refunds on the same customer.
    const [updated] = await tx<{ credit_balance: string }[]>`
      UPDATE customers
      SET credit_balance = credit_balance - ${amount.toFixed(2)}
      WHERE id = ${customerId} AND credit_balance >= ${amount.toFixed(2)}
      RETURNING credit_balance
    `;
    if (!updated) throw new Error('Refund amount exceeds available credit balance.');

    // Durable record of this refund event — gives wallet_transactions a real,
    // individually-traceable row to point at (mirrors how returns.ts anchors
    // its cash refunds to a `returns` row) instead of the customer's own id.
    const [creditRefund] = await tx<{ id: string }[]>`
      INSERT INTO credit_refunds (customer_id, account_id, amount, notes, created_by)
      VALUES (${customerId}, ${accountId}, ${amount.toFixed(2)}, ${notes ?? null}, ${createdBy})
      RETURNING id
    `;

    await tx`
      INSERT INTO wallet_transactions (currency, amount, direction, reason, reference_id, account_id, created_by)
      VALUES ('EGP', ${amount.toFixed(2)}, 'out', 'customer_refund', ${creditRefund.id}, ${accountId}, ${createdBy})
    `;

    await tx`
      UPDATE company_wallet
      SET egp_balance = egp_balance - ${amount.toFixed(2)},
          updated_at  = NOW()
    `;

    await tx`
      UPDATE wallet_accounts
      SET balance    = balance - ${amount.toFixed(2)},
          updated_at = NOW()
      WHERE id = ${accountId}
    `;
  });
}

export type CreditRefundRow = {
  id:             string;
  amount:         string;
  notes:          string | null;
  created_at:     Date;
  account_method: string;
};

export async function getCreditRefundsByCustomer(customerId: string): Promise<CreditRefundRow[]> {
  return sql<CreditRefundRow[]>`
    SELECT
      cr.id,
      cr.amount,
      cr.notes,
      cr.created_at,
      wa.method AS account_method
    FROM credit_refunds cr
    JOIN wallet_accounts wa ON wa.id = cr.account_id
    WHERE cr.customer_id = ${customerId}
    ORDER BY cr.created_at DESC
  `;
}










