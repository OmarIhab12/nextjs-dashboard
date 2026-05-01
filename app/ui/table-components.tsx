import { ReactNode } from 'react';

// ── TableContainer ────────────────────────────────────────────
// The outer shell shared by all tables
export function TableContainer({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white overflow-hidden">
      {children}
    </div>
  );
}

// ── TableHeader ───────────────────────────────────────────────
// The grey column header row — accepts column labels as an array.
// Pass gridCols as a Tailwind grid-cols string to match the table's layout.
// The last column is always reserved for actions (no label).
export function TableHeader({
  columns,
  gridCols,
}: {
  columns: string[];
  gridCols: string;
}) {
  return (
    <div
      className={`grid ${gridCols} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}
    >
      {columns.map((col) => (
        <span key={col}>{col}</span>
      ))}
      {/* Empty cell for actions column */}
      <span />
    </div>
  );
}

// ── TableRows ─────────────────────────────────────────────────
// The rows wrapper with dividers
export function TableRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-gray-100">{children}</div>;
}

// ── TableRow ──────────────────────────────────────────────────
// A single clickable/hoverable row
export function TableRow({
  children,
  gridCols,
  className = '',
}: {
  children: ReactNode;
  gridCols: string;
  className?: string;
}) {
  return (
    <div
      className={`grid ${gridCols} items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors ${className}`}
    >
      {children}
    </div>
  );
}

// ── TableActions ──────────────────────────────────────────────
// Right-aligned actions cell — wraps edit/delete/save/cancel buttons
export function TableActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-1">{children}</div>
  );
}

// ── TableEmpty ────────────────────────────────────────────────
// Empty state row shown when there are no results
export function TableEmpty({ message = 'No results found.' }: { message?: string }) {
  return (
    <div className="py-10 text-center text-sm text-gray-400">{message}</div>
  );
}

// ── MobileCard ────────────────────────────────────────────────
// Wrapper for the mobile card layout
export function MobileCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      {children}
    </div>
  );
}

export function MobileCardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
      {children}
    </div>
  );
}

export function MobileCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-3">{children}</div>
  );
}