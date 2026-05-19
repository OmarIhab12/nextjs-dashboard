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
  getTopCustomersByRevenue,
  getMonthlyPayments,
} from '@/app/lib/db/dashboard';
import DashboardLatestInvoices from '@/app/ui/dashboard/latest-invoices';
import DashboardLatestOrders   from '@/app/ui/dashboard/latest-orders';
import DashboardTopProducts    from '@/app/ui/dashboard/top-products';
import DashboardTopBuyers     from '@/app/ui/dashboard/top-customers';
import DashboardWallet         from '@/app/ui/dashboard/wallet-card';
import DashboardRevenueChart   from '@/app/ui/dashboard/revenue-chart';
import DashboardTopDebtors    from '@/app/ui/dashboard/top-debtors';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [
    invoices,
    orders,
    topProducts,
    topDebtors,
    monthlySales,
    wallet,
    topCustomers,
    monthlyPayments,
  ] = await Promise.all([
    getLatestInvoices(),
    getLatestOrders(),
    getTopProducts(),
    getTopDebtors(),
    getMonthlySales(),
    getDashboardWallet(),
    getTopCustomersByRevenue(),
    getMonthlyPayments(),
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
        <DashboardRevenueChart data={monthlySales} title="Monthly Sales · Last 12 Months" color="#2563eb" />
      </div>

      {/* ── Payments chart — full width ── */}
      <div className="mb-6">
        <DashboardRevenueChart data={monthlyPayments} title="Monthly Income · Last 12 Months" color="#10b981" />
      </div>

      {/* ── Latest invoices + Latest orders ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardLatestInvoices invoices={invoices} />
        <DashboardLatestOrders   orders={orders} />
      </div>

      {/* ── Top products + Top buyers ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTopProducts products={topProducts} />
        <DashboardTopBuyers customers={topCustomers} />
      </div>

      {/* ── Top products + Top debtors ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTopDebtors debtors={topDebtors} />
      </div>
    </main>
  );
}