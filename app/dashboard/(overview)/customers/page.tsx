
import { lusitana } from '@/app/ui/fonts';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { Suspense } from 'react';

import Table from '@/app/ui/customers/table';
import { fetchFilteredCustomers, fetchCustomersPages, getAllCustomers } from '@/app/lib/db/customers';
import Pagination from '@/app/ui/pagination';
import Search from '@/app/ui/search';
 
// app/dashboard/customers/page.tsx
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const query       = resolvedParams?.query ?? '';
  const currentPage = Number(resolvedParams?.page ?? 1);

  const [customers, totalPages] = await Promise.all([
    fetchFilteredCustomers(query, currentPage),
    fetchCustomersPages(query),
  ]);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-3">
        <h1 className={`${lusitana.className} text-2xl`}>Customers</h1>
        
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search customers..." />
      </div>
      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <Table key={`${query}-${currentPage}`} customers={customers}/>
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}