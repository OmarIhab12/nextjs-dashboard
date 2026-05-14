// app/dashboard/(overview)/page.tsx

import { lusitana }          from '@/app/ui/fonts';
import { Suspense }           from 'react';
import {
  getLatestInvoices,
  getLatestOrders,
  getTopProducts,
  getTopDebtors,
  getMonthlySales,
  getDashboardWallet,
} from '@/app/lib/db/dashboard';
import DashboardLatestInvoices from '@/app/ui/dashboard/latest-invoices';
import DashboardLatestOrders   from '@/app/ui/dashboard/latest-orders';
import DashboardTopProducts    from '@/app/ui/dashboard/top-products';
import DashboardTopDebtors     from '@/app/ui/dashboard/top-debtors';
import DashboardWallet         from '@/app/ui/dashboard/wallet-card';
import DashboardRevenueChart   from '@/app/ui/dashboard/revenue-chart';

export default async function Page() {
  const [
    invoices,
    orders,
    topProducts,
    topDebtors,
    monthlySales,
    wallet,
  ] = await Promise.all([
    getLatestInvoices(),
    getLatestOrders(),
    getTopProducts(),
    getTopDebtors(),
    getMonthlySales(),
    getDashboardWallet(),
  ]);

  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-xl md:text-2xl`}>
        Dashboard
      </h1>

      {/* ── Wallet summary — top full width ── */}
      <div className="mb-6">
        <DashboardWallet
          egpBalance={wallet.egp_balance}
          usdBalance={wallet.usd_balance}
        />
      </div>

      {/* ── Revenue chart — full width ── */}
      <div className="mb-6">
        <DashboardRevenueChart data={monthlySales} />
      </div>

      {/* ── Latest invoices + Latest orders ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardLatestInvoices invoices={invoices} />
        <DashboardLatestOrders   orders={orders} />
      </div>

      {/* ── Top products + Top debtors ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTopProducts products={topProducts} />
        <DashboardTopDebtors  debtors={topDebtors} />
      </div>
    </main>
  );
}