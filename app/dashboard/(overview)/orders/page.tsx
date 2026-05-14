// app/dashboard/orders/page.tsx

import { lusitana }           from '@/app/ui/fonts';
import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
import { Suspense }           from 'react';
import { getOrderCount }      from '@/app/lib/db/orders';
import OrdersTable            from '@/app/ui/orders/table';
import { CreateOrder }        from '@/app/ui/orders/buttons';
import Pagination             from '@/app/ui/pagination';
import Search                 from '@/app/ui/search';

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ query?: string; page?: string }>;
}) {
  const resolved    = await searchParams;
  const query       = resolved?.query       ?? '';
  const currentPage = Number(resolved?.page ?? 1);
  const totalCount  = await getOrderCount(query);
  const totalPages  = Math.ceil(totalCount / 10);

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between">
        <h1 className={`${lusitana.className} text-2xl`}>Orders</h1>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
        <Search placeholder="Search orders..." />
        <CreateOrder />
      </div>
      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
        <OrdersTable query={query} currentPage={currentPage} />
      </Suspense>
      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}