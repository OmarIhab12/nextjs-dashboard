'use client';

// app/ui/dashboard/latest-invoices.tsx

import Link                      from 'next/link';
import DashboardCard             from '@/app/ui/dashboard/dashboard-card';
import { InvoiceStatus }         from '@/app/ui/shared/status';
import type { DashboardInvoice } from '@/app/lib/db/dashboard';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const COLS = 'grid-cols-[2fr_1fr_1fr_1fr]';

export default function DashboardLatestInvoices({
  invoices,
}: {
  invoices: DashboardInvoice[];
}) {
  return (
    <DashboardCard title="Latest Invoices">
      {/* Header */}
      <div className={`grid ${COLS} gap-2 border-b border-gray-50 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
        <span>Customer</span>
        <span>Date</span>
        <span>Status</span>
        <span className="text-right">Amount</span>
      </div>

      {invoices.length === 0 && (
        <p className="mt-4 text-sm text-gray-300">No invoices yet.</p>
      )}

      <div className="divide-y divide-gray-50">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/dashboard/invoices/${inv.id}/edit`}
            className={`grid ${COLS} items-center gap-2 py-2.5 hover:opacity-75 transition-opacity`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-800">{inv.customer_name}</p>
              <p className="truncate text-xs text-gray-400">{inv.customer_email}</p>
            </div>
            <span className="text-xs text-gray-500">{fmtDate(inv.created_at)}</span>
            <div><InvoiceStatus status={inv.status as any} /></div>
            <span className="text-right text-sm font-semibold tabular-nums text-gray-700">
              E£ {fmt(Number(inv.total))}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 border-t border-gray-50 pt-3">
        <Link href="/dashboard/invoices" className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
          View all invoices →
        </Link>
      </div>
    </DashboardCard>
  );
}