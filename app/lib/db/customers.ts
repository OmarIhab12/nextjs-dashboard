import sql from "../db";

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  image_url: string;
  city: string | null;
  country: string | null;
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
  total: string;
  payment_status: 'pending' | 'partial' | 'paid' | 'overdue';
};
 
export type CustomerPaymentSummary = {
  id: string;
  amount: string;
  paid_at: Date;
  payment_method: string;
  invoice_ids: string[]; // which invoices this payment was applied to
};
 
export type CustomerPageData = {
  customer:        Customer;
  invoiceSummaries: CustomerInvoiceSummary[];
  paymentSummaries: CustomerPaymentSummary[];
  totalOwed:       number; // sum of all unpaid/partial invoice remainders
  totalPaid:       number; // sum of all payments
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
 
  // Invoice summaries with computed payment_status
  const invoiceSummaries = await sql<CustomerInvoiceSummary[]>`
    SELECT
      invoices.id,
      invoices.created_at,
      invoices.due_date,
      invoices.total,
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
    WHERE invoices.customer_id = ${customerId}
    GROUP BY invoices.id, invoices.created_at, invoices.due_date, invoices.total
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
  WHERE p.invoice_id IN (
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
 
  return { customer, invoiceSummaries, paymentSummaries, totalOwed, totalPaid };
}
 
// ── Auto-allocate payment across oldest unpaid invoices ───────
// Returns the payment record after allocating across installments
export async function addPaymentForCustomer(
  customerId: string,
  amount: number,
  paymentMethod: string,
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
 
    if (installments.length === 0) return;
 
    // Insert payment record — use the first invoice_id as the anchor
    const [payment] = await tx`
      INSERT INTO payments (invoice_id, amount, payment_method, reference)
      VALUES (
        ${installments[0].invoice_id},
        ${amount},
        ${paymentMethod}::payment_method,
        ${reference ?? null}
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
          amount_remaining = amount_remaining - ${allocated},
          status = CASE
            WHEN amount_remaining - ${allocated} <= 0 THEN 'paid'::payment_status
            ELSE 'partial'::payment_status
          END
        WHERE id = ${inst.id}
      `;
    }
  });
}
 









