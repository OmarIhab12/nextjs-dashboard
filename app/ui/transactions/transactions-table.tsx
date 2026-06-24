// app/ui/transactions/transactions-table.tsx

import {
  TableContainer,
  TableRows,
  TableRow,
  TableEmpty,
} from '@/app/ui/table-components';
import { ColHeader } from '@/app/ui/shared/transaction-list';
import { fetchTransactionsPage, type TransactionRow } from '@/app/lib/db/wallet';

// ── Helpers ───────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOL: Record<string, string> = {
  EGP: 'E£',
  USD: '$',
  RMB: '¥',
};

const REASON_LABEL: Record<TransactionRow['reason'], string> = {
  invoice_payment: 'Invoice Payment',
  customer_refund: 'Customer Refund',
  expense:         'Expense',
  order_payment:   'Order Payment',
  conversion:      'Conversion',
  opening_balance: 'Opening Balance',
};

const REASON_STYLE: Record<TransactionRow['reason'], string> = {
  invoice_payment: 'bg-blue-50 text-blue-700',
  customer_refund: 'bg-orange-50 text-orange-700',
  expense:         'bg-red-50 text-red-700',
  order_payment:   'bg-purple-50 text-purple-700',
  conversion:      'bg-gray-100 text-gray-600',
  opening_balance: 'bg-emerald-50 text-emerald-700',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ── Desktop ───────────────────────────────────────────────────────────────────

const COLS = 'grid-cols-[10rem_6rem_9rem_6rem_9rem_1fr_7rem]';

function DesktopTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className="hidden md:block">
      <TableContainer>
        <ColHeader
          cols={COLS}
          headers={[
            { label: 'Date' },
            { label: 'Currency' },
            { label: 'Amount',  align: 'right' },
            { label: 'Flow' },
            { label: 'Reason' },
            { label: 'Created By' },
            { label: 'Chain', align: 'center' },
          ]}
        />
        <TableRows>
          {rows.length === 0 && <TableEmpty message="No transactions found." />}
          {rows.map((tx) => {
            const isIn      = tx.direction === 'in';
            const symbol    = CURRENCY_SYMBOL[tx.currency] ?? tx.currency;
            const isChained = tx.corrects_id !== null;

            return (
              <TableRow key={tx.id} gridCols={COLS}>
                {/* Date */}
                <span className="text-xs text-gray-500 tabular-nums">
                  {fmtDateTime(tx.created_at)}
                </span>

                {/* Currency badge */}
                <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-700">
                  {tx.currency}
                </span>

                {/* Amount */}
                <span
                  className={`text-right text-sm font-semibold tabular-nums ${
                    isIn ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  {isIn ? '+' : '-'}{symbol} {fmt(Number(tx.amount))}
                </span>

                {/* Direction badge */}
                <span
                  className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isIn
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-600'
                  }`}
                >
                  {isIn ? 'In' : 'Out'}
                </span>

                {/* Reason badge */}
                <span
                  className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-xs font-medium ${REASON_STYLE[tx.reason]}`}
                >
                  {REASON_LABEL[tx.reason]}
                </span>

                {/* Created by */}
                <span className="truncate text-xs text-gray-700">
                  {tx.created_by_name}
                </span>

                {/* Correction chain indicator */}
                <div className="flex justify-center">
                  {isChained && (
                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-yellow-50 text-yellow-700">
                      Correction
                    </span>
                  )}
                </div>
              </TableRow>
            );
          })}
        </TableRows>
      </TableContainer>
    </div>
  );
}

// ── Mobile ────────────────────────────────────────────────────────────────────

function MobileList({ rows }: { rows: TransactionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="md:hidden py-10 text-center text-sm text-gray-400">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="md:hidden space-y-2">
      {rows.map((tx) => {
        const isIn   = tx.direction === 'in';
        const symbol = CURRENCY_SYMBOL[tx.currency] ?? tx.currency;

        return (
          <div
            key={tx.id}
            className="rounded-md border border-gray-200 bg-white p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isIn ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {isIn ? 'In' : 'Out'}
                </span>
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${REASON_STYLE[tx.reason]}`}
                >
                  {REASON_LABEL[tx.reason]}
                </span>
                {tx.corrects_id && (
                  <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs bg-yellow-50 text-yellow-700">
                    Correction
                  </span>
                )}
              </div>

              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  isIn ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {isIn ? '+' : '-'}{symbol} {fmt(Number(tx.amount))}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>{tx.created_by_name}</span>
              <span>{fmtDateTime(tx.created_at)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default async function TransactionsTable({ page }: { page: number }) {
  const rows = await fetchTransactionsPage(page);
  return (
    <>
      <DesktopTable rows={rows} />
      <MobileList  rows={rows} />
    </>
  );
}
