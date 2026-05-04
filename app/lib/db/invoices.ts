'use server';
import sql from "../db";
import { formatCurrency } from '../utils';
import { PaymentStatus, syncInstallmentWithInvoice } from "./installments";
import { z } from 'zod';
import postgres from 'postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getProductById} from '@/app/lib/db/products';

export type InvoiceStatus = "draft" | "confirmed" | "cancelled" | "shipped" ;
export type DiscountType  = "percentage" | "amount";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
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
  discount_type: DiscountType;
  discount_value: number;
  subtotal: string;
  discount_amount: string;
  total: string;
  due_date: Date;
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
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}

export interface CreateInvoiceInput {
  customer_id: string;
  created_by: string;
  items: CreateInvoiceItemInput[];
  discount_type: DiscountType;
  discount_value: number;
  due_date: Date;
  notes?: string;
}

export interface UpdateInvoiceForm {
  id: string;
  customer_id: string;
  status: InvoiceStatus;
  discount_type: DiscountType;
  discount_value: number;
  due_date: Date;
  notes?: string | null;
  items: CreateInvoiceItemInput[];
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

export type State = {
  errors: {
    customer_id?:    string[];
    discount_type?:  string[];
    discount_value?: string[];
    due_date?:       string[];
    notes?:          string[];
    items?:          string[];
  };
  message: string | null;
};


const FormSchema = z.object({
  id: z.string(),
  customer_id: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  discount_value: z.coerce
    .number()
    .gte(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['draft', 'confirmed', 'shipped', 'cancelled'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  discount_type: z.enum(['percentage', 'amount'], {
    invalid_type_error: 'Please select valid discount type',
  }),
  due_date: z.string(),
  notes: z.string(),
});

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


const EditSubmitInvoive = FormSchema.omit({ id: true});

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceForm
): Promise<Invoice | null> {

  const { subtotal, discountAmount, total } = computeTotals(
    input.items,
    input.discount_type,
    input.discount_value
  );
  
  return await sql.begin(async (tx) => {
  const [invoice] = await tx<Invoice[]>`
    UPDATE invoices
    SET
      customer_id     = COALESCE(${input.customer_id   ?? null}, customer_id),
      status          = COALESCE(${input.status        ?? null}::invoice_status, status),
      discount_type   = COALESCE(${input.discount_type ?? null}::discount_type, discount_type),
      discount_value  = COALESCE(${input.discount_value  !== undefined ? input.discount_value  : null}, discount_value),
      due_date        = COALESCE(${input.due_date        !== undefined ? input.due_date        : null}, due_date),
      notes           = COALESCE(${input.notes           !== undefined ? input.notes           : null}, notes),
      discount_amount = COALESCE(${discountAmount !== undefined ? discountAmount : null}, discount_amount),
      subtotal       = COALESCE(${subtotal  !== undefined ? subtotal  : null}, subtotal),
      total        = COALESCE(${total  !== undefined ? total  : null}, total)
    WHERE id = ${id}
    RETURNING *
  `;

  if (!invoice) return null;

  // Handle item changes
  await updateInvoiceItems(id, input.items, tx);

  
  await syncInstallmentWithInvoice(invoice.id, total, invoice.customer_id, tx);

  return invoice;
  
  });
}

export async function updateInvoiceItems(
  invoiceId: string,
  newItems: CreateInvoiceItemInput[],
  tx: postgres.TransactionSql
): Promise<InvoiceItem[]> {

  // Fetch current items from DB
  const existingItems = await tx<InvoiceItem[]>`
    SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}
  `;

  const existingMap = new Map(existingItems.map((i) => [i.product_id, i]));
  const newMap      = new Map(newItems.map((i) => [i.product_id, i]));

  // ── Deleted items ─────────────────────────────────────────
  // Items in DB but not in the new list
  const deleted = existingItems.filter((i) => i.product_id && !newMap.has(i.product_id));

  await Promise.all(
    deleted.map(async (item) => {
      await tx`
        DELETE FROM invoice_items
        WHERE invoice_id = ${invoiceId}
          AND product_id = ${item.product_id}
      `;
    })
  );

  // ── Edited items ──────────────────────────────────────────
  // Items that exist in both old and new list
  const edited = newItems.filter((i) => i.product_id && existingMap.has(i.product_id));

  await Promise.all(
    edited.map(async (item) => {
      const existing = existingMap.get(item.product_id)!;
      const qtyDiff  = item.quantity - existing.quantity; // positive = more, negative = less

      await tx`
        UPDATE invoice_items
        SET
          product_name = ${item.product_name},
          unit_price   = ${item.unit_price},
          quantity     = ${item.quantity},
          line_total   = ${item.unit_price * item.quantity}
        WHERE invoice_id = ${invoiceId}
          AND product_id = ${item.product_id}
      `;
    })
  );

  // ── Added items ───────────────────────────────────────────
  // Items in new list but not in DB
  const added = newItems.filter((i) => i.product_id && !existingMap.has(i.product_id));

  await Promise.all(
    added.map(async (item) => {
      await tx<InvoiceItem[]>`
        INSERT INTO invoice_items
          (invoice_id, product_id, product_name, unit_price, quantity, line_total)
        VALUES (
          ${invoiceId},
          ${item.product_id ?? null},
          ${item.product_name},
          ${item.unit_price},
          ${item.quantity},
          ${item.unit_price * item.quantity}
        )
      `;
    })
  );
    
  // Return the updated items
  return tx<InvoiceItem[]>`
    SELECT * FROM invoice_items WHERE invoice_id = ${invoiceId}
  `;
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

export async function deleteInvoice(id: string){
  // invoice_items and installments cascade; payments are restricted
  const result = await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `;
  
  revalidatePath('/dashboard/invoices')
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


const CreateInvoice = FormSchema.omit({ id: true});

export async function createInvoiceAction(prevState: State, formData: FormData): Promise<State>{
  

  let items: CreateInvoiceItemInput[] = [];
  try {
    items = JSON.parse(formData.get("items") as string ?? "[]");
  } catch {
    return {
      errors: { items: ['Invalid product data. Please try again.'] },
      message: 'Failed to Create Invoice.',
    };
  }
 
  if (items.length === 0) {
    return {
      errors: { items: ['Please add at least one product.'] },
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  for (const item of items) {
    if (!item.product_id) continue;
    const product = await getProductById(item.product_id);
    if (!product) {
      return {
        errors: { items: [`Product not found: ${item.product_name}`] },
        message: 'Validation failed.',
      };
    }
    if (item.quantity > product.stock_quantity) {
      return {
        errors: {
          items: [
            `"${product.name}" only has ${product.stock_quantity} units in stock but ${item.quantity} were requested.`,
          ],
        },
        message: 'Validation failed.',
      };
    }
  }

  const validatedFields = CreateInvoice.safeParse({
    customer_id: formData.get('customer_id'),
    status: formData.get('status'),
    discount_type: formData.get('discount_type'),
    discount_value: formData.get('discount_value'),
    due_date: formData.get('due_date'),
    notes: formData.get('notes') ?? '',
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields Validations. Failed to Create Invoice.',
    };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return { errors: {}, message: 'You must be signed in to create an invoice.' };
  }

  const userId = session.user.id;

  await createInvoice({
    customer_id:    formData.get("customer_id") as string,
    created_by:     userId, // from session
    due_date:       formData.get("due_date") ? new Date(formData.get("due_date") as string) : new Date(),
    discount_type:  formData.get("discount_type") as any || undefined,
    discount_value: formData.get("discount_value") ? parseFloat(formData.get("discount_value") as string) : 0,
    notes:          formData.get("notes") as string || undefined,
    items,
  });

  redirect("/dashboard/invoices");
}

export async function updateInvoiceAction(
  prevState: State,
  id: string,
  formData: FormData
): Promise<State>{
  
  let items: CreateInvoiceItemInput[] = [];
  try {
    items = JSON.parse(formData.get("items") as string ?? "[]");
  } catch {
    return {
      errors: { items: ['Invalid product data. Please try again.'] },
      message: 'Failed to Create Invoice.',
    };
  }
 
  if (items.length === 0) {
    return {
      errors: { items: ['Please add at least one product.'] },
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const existingItems = await getInvoiceById(id);
  const existingItemMap = new Map(
    existingItems?.items.map((i) => [i.product_id, i.quantity]) ?? []
  );

  for (const item of items) {
    if (!item.product_id) continue;
    const product = await getProductById(item.product_id);
    if (!product) {
      return {
        errors: { items: [`Product not found: ${item.product_name}`] },
        message: 'Validation failed.',
      };
    }
    const alreadyReserved = existingItemMap.get(item.product_id) ?? 0;
    const availableStock  = product.stock_quantity + Number(alreadyReserved);

    if (item.quantity > availableStock) {
      return {
        errors: {
          items: [
            `"${product.name}" only has ${product.stock_quantity} units in stock but ${item.quantity} were requested.`,
          ],
        },
        message: 'Validation failed.',
      };
    }
  }

  const { customer_id, due_date, status, discount_type, discount_value, notes } = EditSubmitInvoive.parse({
    customer_id: formData.get('customer_id'),
    status: formData.get('status'),
    discount_type: formData.get('discount_type'),
    discount_value: formData.get('discount_value'),
    due_date: formData.get('due_date'),
    notes: formData.get('notes'),
  });
  await updateInvoice(id, {
    id: id,
    customer_id:    customer_id as string,
    status:         status as InvoiceStatus,
    due_date:       due_date ? new Date(formData.get("due_date") as string) : new Date(),
    discount_type:  discount_type as any || undefined,
    discount_value: discount_value ? parseFloat(formData.get("discount_value") as string) : 0,
    notes:          notes as string || undefined,
    items,
  });
  
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}
// OR invoices.status ILIKE ${`%${query}%`}