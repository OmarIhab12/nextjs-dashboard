// import Pagination from '@/app/ui/invoices/pagination';
import { lusitana } from '@/app/ui/fonts';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { Suspense } from 'react';

import Table from '@/app/ui/products/table';
import { fetchFilteredProducts, fetchProductPages, getAllProducts } from '@/app/lib/db/products';
import ProductSearch from '@/app/ui/search';
import Pagination from '@/app/ui/pagination';
import Search from '@/app/ui/search';
 
// app/dashboard/products/page.tsx
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const query       = resolvedParams?.query ?? '';
  const currentPage = Number(resolvedParams?.page ?? 1);

  const [products, totalPages] = await Promise.all([
    fetchFilteredProducts(query, currentPage),
    fetchProductPages(query),
  ]);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Products</h1>
        
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search products..." />
      </div>
      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <Table key={`${query}-${currentPage}`} products={products}/>
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}