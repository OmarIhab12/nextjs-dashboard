import Link from 'next/link';
import { PencilIcon } from '@heroicons/react/24/outline';
import { TableContainer, TableRows, TableActions, TableEmpty } from '@/app/ui/table-components';

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
};

export default function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  return (
    <TableContainer>
      {/* Column headers */}
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_5rem] gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        <span>Name</span>
        <span>Email</span>
        <span>Phone</span>
        <span>City</span>
        <span>Country</span>
        <span />
      </div>

      <TableRows>
        {customers.length === 0 && <TableEmpty message="No customers found." />}
        {customers.map((c) => (
          <div
            key={c.id}
            className="grid grid-cols-[2fr_2fr_1fr_1fr_1fr_5rem] items-center gap-2 px-3 py-2 hover:bg-gray-50/50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
            <span className="text-sm text-gray-500 truncate">
              {c.email ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {c.phone ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {c.city ?? <span className="text-gray-300">—</span>}
            </span>
            <span className="text-sm text-gray-500">
              {c.country ?? <span className="text-gray-300">—</span>}
            </span>
            <TableActions>
              <Link
                href={`/dashboard/customers/${c.id}`}
                title="View customer"
                className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                <PencilIcon className="h-4 w-4" />
              </Link>
            </TableActions>
          </div>
        ))}
      </TableRows>
    </TableContainer>
  );
}