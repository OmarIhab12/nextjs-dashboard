'use server';
import sql from "../db";
import { formatCurrency } from '../utils';
import { PaymentStatus } from "./installments";
 import { z } from 'zod';
 import postgres from 'postgres';
 import { revalidatePath } from 'next/cache';
 import { redirect } from 'next/navigation';

export type InvoiceStatus = "draft" | "confirmed" | "cancelled" | "shipped" ;
export type DiscountType  = "percentage" | "amount";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface Invoice {
  id: string;
  customer_id: string;
  created_by: string;
  status: InvoiceStatus;
  discount_type: DiscountType | null;
  discount_value: string | null;
  subtotal: string;
  discount_amount: string;
  total: string;
  due_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export type InvoicesTable = {
  id: string;
  customer_id: string;
  name: string;
  email: string;
  image_url: string;
  created_at: string;
  total: string;
  status: InvoiceStatus;
  payment_status: PaymentStatus;
};

export type LatestInvoice = {
  id: string;
  name: string;
  image_url: string;
  email: string;
  total: string;
};

export type InvoiceForm = {
  id: string;
  customer_id: string;
  total: number;
  status: InvoiceStatus;
};

export type LatestInvoiceRaw = Omit<LatestInvoice, 'total'> & {
  total: number;
};

export interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
}

export interface CreateInvoiceItemInput {
  product_id?: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface CreateInvoiceInput {
  customer_id: string;
  created_by: string;
  items: CreateInvoiceItemInput[];
  discount_type?: DiscountType;
  discount_value?: number;
  due_date?: Date;
  notes?: string;
}

export interface UpdateInvoiceForm {
  id: string;
  customer_id?: string;
  status?: InvoiceStatus;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
  due_date?: Date | null;
  notes?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────

function computeTotals(
  items: CreateInvoiceItemInput[],
  discountType?: DiscountType,
  discountValue?: number
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  );

  let discountAmount = 0;
  if (discountType === "percentage" && discountValue) {
    discountAmount = (subtotal * discountValue) / 100;
  } else if (discountType === "amount" && discountValue) {
    discountAmount = Math.min(discountValue, subtotal);
  }

  const total = subtotal - discountAmount;
  return { subtotal, discountAmount, total };
}

// ── Queries ──────────────────────────────────────────────────

export async function getAllInvoices(): Promise<Invoice[]> {
  return sql<Invoice[]>`
    SELECT * FROM invoices
    ORDER BY created_at DESC
  `;
}

export async function getInvoiceById(
  id: string
): Promise<InvoiceWithItems | null> {
  console.log("getting invoice by id " + id);
  const [invoice] = await sql<Invoice[]>`
    SELECT * FROM invoices
    WHERE id = ${id}
  `;
  if (!invoice) return null;

  const items = await sql<InvoiceItem[]>`
    SELECT * FROM invoice_items
    WHERE invoice_id = ${id}
  `;

  return { ...invoice, items };
}

export async function getInvoicesByCustomer(
  customerId: string
): Promise<Invoice[]> {
  return sql<Invoice[]>`
    SELECT * FROM invoices
    WHERE customer_id = ${customerId}
    ORDER BY created_at DESC
  `;
}

export async function getInvoicesByStatus(
  status: InvoiceStatus
): Promise<Invoice[]> {
  return sql<Invoice[]>`
    SELECT * FROM invoices
    WHERE status = ${status}
    ORDER BY created_at DESC
  `;
}

export async function getLatestInvoices() {
  try {
    
    // await new Promise((resolve) => setTimeout(resolve, 3000));
    const data = await sql<LatestInvoiceRaw[]>`
      SELECT invoices.total, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.created_at DESC
      LIMIT 5`;

    const latestInvoices = data.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.total),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}
// ── Mutations ────────────────────────────────────────────────

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<InvoiceWithItems> {
  const { subtotal, discountAmount, total } = computeTotals(
    input.items,
    input.discount_type,
    input.discount_value
  );

  return await sql.begin(async (tx) => {
    // 1. Insert invoice — the DB trigger auto-creates one installment
    const [invoice] = await tx<Invoice[]>`
      INSERT INTO invoices (
        customer_id, created_by,
        discount_type, discount_value,
        subtotal, discount_amount, total,
        due_date, notes
      ) VALUES (
        ${input.customer_id},
        ${input.created_by},
        ${input.discount_type   ?? null}::discount_type,
        ${input.discount_value  ?? null},
        ${subtotal},
        ${discountAmount},
        ${total},
        ${input.due_date        ?? null},
        ${input.notes           ?? null}
      )
      RETURNING *
    `;

    // 2. Insert line items
    const items = await Promise.all(
      input.items.map((item) =>
        tx<InvoiceItem[]>`
          INSERT INTO invoice_items
            (invoice_id, product_id, product_name, unit_price, quantity, line_total)
          VALUES (
            ${invoice.id},
            ${item.product_id  ?? null},
            ${item.product_name},
            ${item.unit_price},
            ${item.quantity},
            ${item.unit_price * item.quantity}
          )
          RETURNING *
        `.then((rows) => rows[0])
      )
    );

    return { ...invoice, items };
  });
}

const FormSchema = z.object({
  id: z.string(),
  customer_id: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  discount_value: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['draft', 'confirmed', 'shipped', 'cancelled'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  discount_type: z.enum(['percentage', 'amount'], {
    invalid_type_error: 'Please select valid discount type',
  }),
  due_date: z.string(),
  notes: z.string(),
});
const EditSubmitInvoive = FormSchema.omit({ id: true});

export async function updateInvoice(
  id: string,
  formData: FormData
) {
  const { customer_id, due_date, status, discount_type, discount_value, notes } = EditSubmitInvoive.parse({
    customer_id: formData.get('customerId'),
    status: formData.get('status'),
    discount_type: formData.get('discount_type'),
    discount_value: formData.get('discount_value'),
    due_date: formData.get('due_date'),
    notes: formData.get('notes'),
  });
  console.log("the invoice update call is send successfully from the UI");
  console.log("The updated invoice id is " + id);
  console.log(customer_id);
  console.log(status);
  console.log(discount_type);
  console.log(discount_value);
  console.log(due_date);
  console.log(notes);
  
  const [invoice] = await sql<Invoice[]>`
    UPDATE invoices
    SET
      customer_id     = ${customer_id},
      status          = ${status},
      discount_type   = ${discount_type},
      discount_value  = ${discount_value},
      due_date        = ${due_date},
      notes           = ${notes}
    WHERE id = ${id}
    RETURNING *
  `;
  revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<Invoice | null> {
  const [invoice] = await sql<Invoice[]>`
    UPDATE invoices
    SET status = ${status}
    WHERE id = ${id}
    RETURNING *
  `;
  return invoice ?? null;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  // invoice_items and installments cascade; payments are restricted
  const result = await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `;
  return result.count > 0;
}
const ITEMS_PER_PAGE = 6;

export async function fetchInvoicesPages(query: string) {
  try {
    const data = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.total::text ILIKE ${`%${query}%`} OR
      invoices.created_at::text ILIKE ${`%${query}%`} 
  `;

    const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable[]>`
      SELECT
        invoices.id,
        invoices.total,
        invoices.created_at,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url,
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
      JOIN customers ON invoices.customer_id = customers.id
      JOIN installments ON installments.invoice_id = invoices.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.total::text ILIKE ${`%${query}%`} OR
        invoices.created_at::text ILIKE ${`%${query}%`}

        GROUP BY
  invoices.id,
  invoices.total,
  invoices.created_at,
  invoices.status,
  invoices.due_date,
  customers.name,
  customers.email,
  customers.image_url
        
      ORDER BY invoices.created_at DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

// OR invoices.status ILIKE ${`%${query}%`}