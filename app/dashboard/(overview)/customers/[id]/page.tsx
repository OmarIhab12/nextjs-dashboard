import { notFound } from 'next/navigation';
import { getCustomerPageData } from '@/app/lib/db/customers';
import { getWalletAccounts } from '@/app/lib/db/wallet-accounts';
import CustomerDetail        from '@/app/ui/customers/customer-details';
import CustomerInvoices      from '@/app/ui/customers/customer-invoices';
import CustomerPayments      from '@/app/ui/customers/customer-payments';
import CustomerReturns       from '@/app/ui/customers/customer-returns';
import CustomerCreditRefunds from '@/app/ui/customers/customer-credit-refunds';
import CreditBalanceBanner   from '@/app/ui/customers/credit-balance-banner';
import { lusitana } from '@/app/ui/fonts';
import { DownloadStatementButton } from '@/app/ui/button';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, allAccounts] = await Promise.all([
    getCustomerPageData(id),
    getWalletAccounts(),
  ]);

  if (!data) notFound();

  const { customer, invoiceSummaries, paymentSummaries, totalOwed, totalPaid, totalCredits, totalCashRefunded } = data;
  const egpAccounts = allAccounts.filter((a) => a.currency === 'EGP');

  return (
    <div className="w-full space-y-6">
      {/* Back link + statement download */}
      <div className="flex items-center justify-between">
        <a
          href="/dashboard/customers"
          className={`${lusitana.className} text-2xl inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors`}
        >
          ← Customers
        </a>
        <DownloadStatementButton customerId={customer.id} customerName={customer.name} />
      </div>

      {/* Customer details — full width */}
      <CustomerDetail customer={customer} />

      {/* Credit balance banner + refund control */}
      <CreditBalanceBanner
        customerId={customer.id}
        creditBalance={Number(customer.credit_balance)}
        egpAccounts={egpAccounts}
      />

      {/* Invoices — full width */}
      <CustomerInvoices
        invoices={invoiceSummaries}
        totalPaid={totalPaid}
        totalCredits={totalCredits}
        totalCashRefunded={totalCashRefunded}
      />

      {/* Payments (left) | Returns (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CustomerPayments
          key={paymentSummaries.length}
          customerId={customer.id}
          payments={paymentSummaries}
          totalOwed={totalOwed}
        />
        <CustomerReturns customerId={customer.id} totalCredits={totalCredits} />
      </div>

      {/* Credit refunds — full width */}
      <CustomerCreditRefunds customerId={customer.id} />
    </div>
  );
}