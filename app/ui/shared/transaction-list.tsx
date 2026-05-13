// app/ui/shared/transaction-list.tsx
// Shared read-only list used by CustomerInvoices and SupplierOrders.
// Shows a summary bar (two stat cards) and a table of rows.

import { TableContainer, TableRows, TableEmpty } from '@/app/ui/table-components';

export function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  accent = false,
}: {
  label:   string;
  value:   string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${
      accent
        ? 'bg-green-50 border-green-100'
        : 'bg-gray-50 border-gray-100'
    }`}>
      <p className={`text-xs ${accent ? 'text-green-600' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm font-semibold tabular-nums ${accent ? 'text-green-700' : 'text-gray-800'}`}>
        {value}
      </p>
    </div>
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

export function ColHeader({
  cols,
  headers,
}: {
  cols:    string;
  headers: { label: string; align?: 'left' | 'center' | 'right' }[];
}) {
  const alignClass = (a?: string) =>
    a === 'center' ? 'text-center' : a === 'right' ? 'text-right' : '';

  return (
    <div className={`grid ${cols} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
      {headers.map((h) => (
        <span key={h.label} className={alignClass(h.align)}>{h.label}</span>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TransactionList<T extends { id: string }>({
  title,
  count,
  statCards,
  cols,
  headers,
  items,
  emptyMessage,
  renderRow,
}: {
  title:        string;
  count?:       number;
  statCards?:   { label: string; value: string; accent?: boolean }[];
  cols:         string;
  headers:      { label: string; align?: 'left' | 'center' | 'right' }[];
  items:        T[];
  emptyMessage: string;
  renderRow:    (item: T) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {count !== undefined && count > 0 && (
          <span className="text-xs text-gray-400">
            {count} {title.toLowerCase().replace(/s$/, '')}{count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Stat cards */}
      {statCards && statCards.length > 0 && items.length > 0 && (
        <div className={`grid grid-cols-${statCards.length} gap-3`}>
          {statCards.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} accent={card.accent} />
          ))}
        </div>
      )}

      {/* Table */}
      <TableContainer>
        <ColHeader cols={cols} headers={headers} />
        <TableRows>
          {items.length === 0 && <TableEmpty message={emptyMessage} />}
          {items.map((item) => (
            <div
              key={item.id}
              className={`grid ${cols} items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors`}
            >
              {renderRow(item)}
            </div>
          ))}
        </TableRows>
      </TableContainer>
    </div>
  );
}
