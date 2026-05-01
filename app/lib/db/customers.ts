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
