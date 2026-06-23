// app/dashboard/(overview)/transactions/page.tsx

import { Suspense }                  from 'react';
import { redirect }                  from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { auth }                      from '@/auth';
import { getTransactionPageCount }   from '@/app/lib/db/wallet';
import Pagination                    from '@/app/ui/pagination';
import TransactionsTable             from '@/app/ui/transactions/transactions-table';

export const dynamic = 'force-dynamic';

export default async function Page(props: {
  searchParams?: Promise<{ page?: string }>;
}) {
  noStore();

  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin' && session.user.role !== 'manager') {
    redirect('/dashboard');
  }

  const searchParams  = await props.searchParams;
  const currentPage   = Math.max(1, Number(searchParams?.page) || 1);
  const totalPages    = await getTransactionPageCount();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Transactions</h1>
        <span className="text-xs text-gray-400">
          Newest first · 10 per page
        </span>
      </div>

      <Suspense key={currentPage} fallback={<TableSkeleton />}>
        <TransactionsTable page={currentPage} />
      </Suspense>

      <div className="mt-5 flex w-full justify-center">
        <Pagination totalPages={totalPages} />
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 h-9" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-3 py-3 last:border-0">
          <div className="h-3 w-32 rounded bg-gray-200" />
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-200" />
          <div className="h-3 flex-1 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}
