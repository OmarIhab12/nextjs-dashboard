// app/ui/suppliers/supplier-payments.tsx
'use client';

import PaymentPanel, { type PaymentRow } from '@/app/ui/shared/payment-panel';
import { addSupplierPaymentAction } from '@/app/lib/actions/suppliers';
import type { OrderPayment } from '@/app/lib/db/order-payments';

export default function SupplierPayments({
  supplierId,
  payments,
  totalOwed,
}: {
  supplierId: string;
  payments:   OrderPayment[];
  totalOwed:  number;   // total USD still owed to this supplier
}) {
  const rows: PaymentRow[] = payments.map((p) => ({
    id:             p.id,
    amount:         p.amount_usd,
    payment_method: p.payment_method,
    paid_at:        p.paid_at,
  }));

  return (
    <PaymentPanel
      title="Payments to Supplier"
      balanceLabel="Amount we owe"
      balanceAmount={totalOwed}
      balanceAccent="blue"
      currencySymbol="$"
      payments={rows}
      canAdd={totalOwed > 0}
      addButtonLabel="Record payment"
      formTitle="Payment to Supplier"
      onAdd={(fd) => addSupplierPaymentAction(supplierId, fd)}
    />
  );
}
