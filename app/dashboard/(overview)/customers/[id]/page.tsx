import { notFound } from 'next/navigation';
import { getCustomerPageData } from '@/app/lib/db/customers';
import CustomerDetail   from '@/app/ui/customers/customer-details';
import CustomerInvoices from '@/app/ui/customers/customer-invoices';
import CustomerPayments from '@/app/ui/customers/customer-payments';
import { lusitana } from '@/app/ui/fonts';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data   = await getCustomerPageData(id);

  if (!data) notFound();

  const { customer, invoiceSummaries, paymentSummaries, totalOwed, totalPaid } = data;

  return (
    <div className="w-full space-y-6">
      {/* Back link */}
      <a
        href="/dashboard/customers"
        className={`${lusitana.className} text-2xl inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors`}
      >
        ← Customers
      </a>

      {/* Customer details — full width */}
      <CustomerDetail customer={customer} />

      {/* Payments (left) | Invoices (right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CustomerInvoices
            invoices={invoiceSummaries}
            totalPaid={totalPaid}
        />
        
        <CustomerPayments
            key={paymentSummaries.length}
            customerId={customer.id}
            payments={paymentSummaries}
            totalOwed={totalOwed}
        />
      </div>
    </div>
  );
}