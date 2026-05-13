// app/ui/customers/table.tsx

import ContactTable, { type ContactRow } from '@/app/ui/shared/contact-table';
import type { Customer } from '@/app/lib/db/customers';

export default function CustomersTable({ customers }: { customers: Customer[] }) {
  const rows: ContactRow[] = customers.map((c) => ({
    id:      c.id,
    name:    c.name,
    email:   c.email   ?? null,
    phone:   c.phone   ?? null,
    city:    c.city    ?? null,
    country: c.country ?? null,
  }));

  return (
    <ContactTable
      rows={rows}
      detailBasePath="/dashboard/customers"
      emptyMessage="No customers found."
    />
  );
}
