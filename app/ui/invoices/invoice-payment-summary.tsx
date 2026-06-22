import { formatCurrencyEGP } from '@/app/lib/utils';

export default function InvoicePaymentSummary({
  invoiceTotal,
  totalDue,
  totalPaid,
}: {
  invoiceTotal: number;
  totalDue: number;
  totalPaid: number;
}) {
  const totalReturns = Number((invoiceTotal - totalDue).toFixed(2));
  const remaining    = Number((totalDue - totalPaid).toFixed(2));
  const isSettled    = remaining <= 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap divide-x divide-gray-100">

        <Cell label="Original Total" value={invoiceTotal} />

        {totalReturns > 0 && (
          <Cell label="Returns" value={-totalReturns} valueClass="text-red-600" />
        )}

        {totalReturns > 0 && (
          <Cell label="Net Obligation" value={totalDue} />
        )}

        <Cell
          label="Amount Paid"
          value={totalPaid}
          valueClass={totalPaid > 0 ? 'text-green-700' : 'text-gray-400'}
        />

        <Cell
          label="Remaining"
          value={remaining}
          valueClass={isSettled ? 'text-green-700' : 'text-amber-700'}
          badge={isSettled ? { label: 'Settled', color: 'bg-green-100 text-green-700' } : undefined}
        />

      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  valueClass = 'text-gray-800',
  badge,
}: {
  label:       string;
  value:       number;
  valueClass?: string;
  badge?:      { label: string; color: string };
}) {
  const display =
    value < 0
      ? `-${formatCurrencyEGP(-value)}`
      : formatCurrencyEGP(value);

  return (
    <div className="flex flex-1 min-w-[120px] flex-col gap-0.5 px-4 py-3">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{display}</span>
        {badge && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.color}`}>
            {badge.label}
          </span>
        )}
      </div>
    </div>
  );
}
