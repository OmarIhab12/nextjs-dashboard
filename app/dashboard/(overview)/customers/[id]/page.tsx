import { notFound } from 'next/navigation';
import { getCustomerPageData } from '@/app/lib/db/customers';
import CustomerDetail   from '@/app/ui/customers/customer-details';
import CustomerInvoices from '@/app/ui/customers/customer-invoices';
import CustomerPayments from '@/app/ui/customers/customer-payments';
import CustomerReturns  from '@/app/ui/customers/customer-returns';
import { lusitana } from '@/app/ui/fonts';
import { DownloadStatementButton } from '@/app/ui/button';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data   = await getCustomerPageData(id);

  if (!data) notFound();

  const { customer, invoiceSummaries, paymentSummaries, totalOwed, totalPaid, totalCredits, totalCashRefunded } = data;

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

      {/* Credit balance banner — only shown when customer has unallocated credit */}
      
        <div className="flex items-center justify-between rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-yellow-800">Available Credit Balance</p>
            <p className="text-xs text-yellow-600 mt-0.5">
              This credit will automatically be applied to the customer&apos;s next invoice.
            </p>
          </div>
          <span className="text-xl font-bold tabular-nums text-yellow-700">
            E£{Number(customer.credit_balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

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
    </div>
  );
}