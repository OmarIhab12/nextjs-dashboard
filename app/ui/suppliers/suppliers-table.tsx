// app/ui/suppliers/table.tsx

import ContactTable, { type ContactRow } from '@/app/ui/shared/contact-table';
import type { Supplier } from '@/app/lib/db/suppliers';

export default function SuppliersTable({ suppliers }: { suppliers: Supplier[] }) {
  const rows: ContactRow[] = suppliers.map((s) => ({
    id:      s.id,
    name:    s.name,
    email:   s.email   ?? null,
    phone:   s.phone   ?? null,
    city:    s.city    ?? null,
    country: s.country ?? null,
  }));

  return (
    <ContactTable
      rows={rows}
      detailBasePath="/dashboard/suppliers"
      emptyMessage="No suppliers found."
    />
  );
}
