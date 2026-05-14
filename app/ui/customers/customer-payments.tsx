// app/ui/customers/customer-payments.tsx
'use client';

import PaymentPanel, { type PaymentRow } from '@/app/ui/shared/payment-panel';
import { addCustomerPaymentAction } from '@/app/lib/actions/customers';
import type { CustomerPaymentSummary } from '@/app/lib/db/customers';

export default function CustomerPayments({
  customerId,
  payments,
  totalOwed,
}: {
  customerId: string;
  payments:   CustomerPaymentSummary[];
  totalOwed:  number;
}) {
  const rows: PaymentRow[] = payments.map((p) => ({
    id:             p.id,
    amount:         p.amount,
    payment_method: p.payment_method,
    paid_at:        p.paid_at,
  }));

  return (
    <PaymentPanel
      title="Payments"
      balanceLabel="Outstanding balance"
      balanceAmount={totalOwed}
      balanceAccent="amber"
      currencySymbol="E£"
      payments={rows}
      canAdd={totalOwed > 0}
      addButtonLabel="Add payment"
      formTitle="New Payment"
      onAdd={(fd) => addCustomerPaymentAction(customerId, fd)}
    />
  );
}
