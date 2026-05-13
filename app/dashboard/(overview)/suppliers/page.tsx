// app/dashboard/suppliers/page.tsx

import { lusitana } from '@/app/ui/fonts';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { Suspense } from 'react';
import { fetchFilteredSuppliers, getSupplierCount } from '@/app/lib/db/suppliers';
import SuppliersTable from '@/app/ui/suppliers/suppliers-table';
import Pagination from '@/app/ui/pagination';
import Search from '@/app/ui/search';
import AddSupplierButton from '@/app/ui/suppliers/add-supplier-button';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const query       = resolvedParams?.query ?? '';
  const currentPage = Number(resolvedParams?.page ?? 1);

  const [suppliers, totalCount] = await Promise.all([
    fetchFilteredSuppliers(query, currentPage),
    getSupplierCount(query),
  ]);

  const totalPages = Math.ceil(totalCount / 10);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Suppliers</h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search suppliers..." />
        <AddSupplierButton />
      </div>
      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <SuppliersTable key={`${query}-${currentPage}`} suppliers={suppliers} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}
