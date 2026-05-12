// app/lib/db/suppliers.ts

import sql from "@/app/lib/db";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Supplier = {
  id:         string;
  name:       string;
  email:      string | null;
  phone:      string | null;
  address:    string | null;
  city:       string | null;
  country:    string | null;
  notes:      string | null;
  created_at: string;
  updated_at: string;
};

export type CreateSupplierInput = {
  name:     string;
  email?:   string;
  phone?:   string;
  address?: string;
  city?:    string;
  country?: string;
  notes?:   string;
};

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllSuppliers(): Promise<Supplier[]> {
  return sql<Supplier[]>`
    SELECT * FROM suppliers ORDER BY name ASC
  `;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const [row] = await sql<Supplier[]>`
    SELECT * FROM suppliers WHERE id = ${id}
  `;
  return row ?? null;
}

export async function fetchFilteredSuppliers(
  query:   string,
  page:    number,
  perPage = 10,
): Promise<Supplier[]> {
  const offset = (page - 1) * perPage;
  return sql<Supplier[]>`
    SELECT * FROM suppliers
    WHERE
      name    ILIKE ${'%' + query + '%'} OR
      email   ILIKE ${'%' + query + '%'} OR
      city    ILIKE ${'%' + query + '%'} OR
      country ILIKE ${'%' + query + '%'}
    ORDER BY name ASC
    LIMIT ${perPage} OFFSET ${offset}
  `;
}

export async function getSupplierCount(query = ''): Promise<number> {
  const [row] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM suppliers
    WHERE
      name    ILIKE ${'%' + query + '%'} OR
      email   ILIKE ${'%' + query + '%'} OR
      city    ILIKE ${'%' + query + '%'} OR
      country ILIKE ${'%' + query + '%'}
  `;
  return parseInt(row.count);
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  const [row] = await sql<Supplier[]>`
    INSERT INTO suppliers (name, email, phone, address, city, country, notes)
    VALUES (
      ${input.name},
      ${input.email   ?? null},
      ${input.phone   ?? null},
      ${input.address ?? null},
      ${input.city    ?? null},
      ${input.country ?? null},
      ${input.notes   ?? null}
    )
    RETURNING *
  `;
  return row;
}

export async function updateSupplier(
  id:    string,
  input: UpdateSupplierInput,
): Promise<Supplier> {
  const [row] = await sql<Supplier[]>`
    UPDATE suppliers SET
      name    = COALESCE(${input.name    ?? null}, name),
      email   = COALESCE(${input.email   ?? null}, email),
      phone   = COALESCE(${input.phone   ?? null}, phone),
      address = COALESCE(${input.address ?? null}, address),
      city    = COALESCE(${input.city    ?? null}, city),
      country = COALESCE(${input.country ?? null}, country),
      notes   = COALESCE(${input.notes   ?? null}, notes)
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

export async function deleteSupplier(id: string): Promise<void> {
  await sql`DELETE FROM suppliers WHERE id = ${id}`;
}
