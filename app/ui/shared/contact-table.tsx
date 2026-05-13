// app/ui/shared/contact-table.tsx
// Shared table for any entity with name/email/phone/city/country fields.
// Used by both CustomersTable and SuppliersTable.

import Link from 'next/link';
import { PencilIcon } from '@heroicons/react/24/outline';
import { TableContainer, TableRows, TableActions, TableEmpty } from '@/app/ui/table-components';

export type ContactRow = {
  id:      string;
  name:    string;
  email:   string | null;
  phone:   string | null;
  city:    string | null;
  country: string | null;
};

const COLS = 'grid-cols-[2fr_2fr_1fr_1fr_1fr_5rem]';

export default function ContactTable({
  rows,
  detailBasePath,
  emptyMessage,
}: {
  rows:           ContactRow[];
  detailBasePath: string;   // e.g. '/dashboard/customers' or '/dashboard/suppliers'
  emptyMessage:   string;   // e.g. 'No customers found.'
}) {
  return (
    <div className="mt-6 flow-root">
    <TableContainer>
      <div className={`grid ${COLS} gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400`}>
        <span>Name</span>
        <span>Email</span>
        <span>Phone</span>
        <span>City</span>
        <span>Country</span>
        <span />
      </div>

      <TableRows>
        {rows.length === 0 && <TableEmpty message={emptyMessage} />}
        {rows.map((row) => (
          <div
            key={row.id}
            className={`grid ${COLS} items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors`}
          >
            <span className="text-sm font-medium text-gray-800 truncate">{row.name}</span>
            <span className="text-sm text-gray-500 truncate">
              {row.email ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {row.phone ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {row.city ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {row.country ?? <span className="text-gray-300">—</span>}
            </span>
            <TableActions>
              <Link
                href={`${detailBasePath}/${row.id}`}
                title="View details"
                className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
              </Link>
            </TableActions>
          </div>
        ))}
      </TableRows>
    </TableContainer>
    </div>
  );
}
