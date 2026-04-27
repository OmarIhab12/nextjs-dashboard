import sql from "../db";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: string; // postgres.js returns NUMERIC as string — parse with Number() when needed
  stock_quantity: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock_quantity?: number;
  is_active?: boolean;
}

export type UpdateProductInput = Partial<CreateProductInput>;

// ── Queries ──────────────────────────────────────────────────

export async function getAllProducts(activeOnly = false): Promise<Product[]> {
  return sql<Product[]>`
    SELECT * FROM products
    WHERE ${activeOnly ? sql`is_active = TRUE` : sql`TRUE`}
    ORDER BY name ASC
  `;
}

export async function getProductById(id: string): Promise<Product | null> {
  const [product] = await sql<Product[]>`
    SELECT * FROM products
    WHERE id = ${id}
  `;
  return product ?? null;
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  const [product] = await sql<Product[]>`
    SELECT * FROM products
    WHERE sku = ${sku}
  `;
  return product ?? null;
}

export async function searchProducts(query: string): Promise<Product[]> {
  return sql<Product[]>`
    SELECT * FROM products
    WHERE
      name ILIKE ${"%" + query + "%"}
      OR sku ILIKE ${"%" + query + "%"}
    ORDER BY name ASC
  `;
}

// ── Mutations ────────────────────────────────────────────────

export async function createProduct(
  input: CreateProductInput
): Promise<Product> {
  const [product] = await sql<Product[]>`
    INSERT INTO products (name, description, sku, price, stock_quantity, is_active)
    VALUES (
      ${input.name},
      ${input.description      ?? null},
      ${input.sku              ?? null},
      ${input.price},
      ${input.stock_quantity   ?? 0},
      ${input.is_active        ?? true}
    )
    RETURNING *
  `;
  return product;
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Product | null> {
  const [product] = await sql<Product[]>`
    UPDATE products
    SET
      name           = COALESCE(${input.name           ?? null}, name),
      description    = COALESCE(${input.description    ?? null}, description),
      sku            = COALESCE(${input.sku            ?? null}, sku),
      price          = COALESCE(${input.price          ?? null}, price),
      stock_quantity = COALESCE(${input.stock_quantity ?? null}, stock_quantity),
      is_active      = COALESCE(${input.is_active      ?? null}, is_active)
    WHERE id = ${id}
    RETURNING *
  `;
  return product ?? null;
}

export async function adjustStock(
  id: string,
  delta: number // positive = add stock, negative = remove stock
): Promise<Product | null> {
  const [product] = await sql<Product[]>`
    UPDATE products
    SET stock_quantity = stock_quantity + ${delta}
    WHERE id = ${id}
      AND stock_quantity + ${delta} >= 0
    RETURNING *
  `;
  return product ?? null;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM products
    WHERE id = ${id}
  `;
  return result.count > 0;
}
