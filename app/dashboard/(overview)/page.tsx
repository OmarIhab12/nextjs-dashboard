// app/dashboard/(overview)/page.tsx

import { lusitana }          from '@/app/ui/fonts';
import {
  getLatestInvoices,
  getLatestOrders,
  getTopProducts,
  getTopDebtors,
  getDashboardWallet,
  getTopCustomersByRevenue,
  getInventoryValue,
  getPendingShipments,
  getMonthlyNetFlow,
  getInvoicesByStatus,
  type MonthlyNetFlow,
} from '@/app/lib/db/dashboard';
import DashboardLatestInvoices from '@/app/ui/dashboard/latest-invoices';
import DashboardLatestOrders   from '@/app/ui/dashboard/latest-orders';
import DashboardTopProducts    from '@/app/ui/dashboard/top-products';
import DashboardTopBuyers      from '@/app/ui/dashboard/top-customers';
import DashboardWallet         from '@/app/ui/dashboard/wallet-card';
import DashboardTopDebtors     from '@/app/ui/dashboard/top-debtors';
import CashFlowChart           from '@/app/ui/dashboard/cash-flow-chart';
import InvoiceStatusChart      from '@/app/ui/dashboard/invoice-status-chart';
import InventoryCard           from '@/app/ui/dashboard/inventory-card';
import PendingShipmentsCard    from '@/app/ui/dashboard/pending-shipments-card';
import { getRmbToEgpRate }     from '@/app/lib/exchange-rate';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const [
    invoices,
    orders,
    topProducts,
    topDebtors,
    wallet,
    topCustomers,
    inventory,
    shipments,
    rmbToEgp,
    netFlow,
    invoicesByStatus,
  ] = await Promise.all([
    getLatestInvoices(),
    getLatestOrders(),
    getTopProducts(),
    getTopDebtors(),
    getDashboardWallet(),
    getTopCustomersByRevenue(),
    getInventoryValue(),
    getPendingShipments(),
    getRmbToEgpRate(),
    getMonthlyNetFlow(),
    getInvoicesByStatus(),
  ]);

  const cashFlowData = netFlow.map((d: MonthlyNetFlow) => ({
    month:             d.month,
    sales:             d.sales,
    payments:          d.payments,
    expenses:          d.expenses,
    supplier_payments: rmbToEgp > 0 ? d.supplier_payments_rmb * rmbToEgp : 0,
  }));

  return (
    <main>
      <h1 className={`${lusitana.className} mb-6 text-xl md:text-2xl`}>
        Dashboard
      </h1>

      {/* ── Wallet summary ── */}
      <div className="mb-6">
        <DashboardWallet
          egpBalance={wallet.egp_balance}
          usdBalance={wallet.usd_balance}
          rmbBalance={wallet.rmb_balance}
        />
      </div>

      {/* ── Inventory summary ── */}
      <div className="mb-6">
        <InventoryCard inventory={inventory} />
      </div>

      {/* ── Pending shipments ── */}
      <div className="mb-6">
        <PendingShipmentsCard shipments={shipments} rmbToEgp={rmbToEgp} />
      </div>

      {/* ── Net cash flow chart ── */}
      <div className="mb-6">
        <CashFlowChart data={cashFlowData} />
      </div>

      {/* ── Latest invoices + Latest orders ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardLatestInvoices invoices={invoices} />
        <DashboardLatestOrders   orders={orders} />
      </div>

      {/* ── Top products + Invoice status ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTopProducts products={topProducts} />
        <InvoiceStatusChart data={invoicesByStatus} />
      </div>

      {/* ── Top buyers + Top debtors ── */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardTopBuyers customers={topCustomers} />
        <DashboardTopDebtors debtors={topDebtors} />
      </div>
    </main>
  );
}
