'use server';

import { createProduct, updateProduct, deleteProduct } from '@/app/lib/db/products';
import type { UpdateProductInput, CreateProductInput } from '@/app/lib/db/products';

export async function createProductAction(input: CreateProductInput) {
  return await createProduct(input);
}

export async function updateProductAction(id: string, input: UpdateProductInput) {
  return await updateProduct(id, input);
}

export async function deleteProductAction(id: string) {
  return await deleteProduct(id);
}