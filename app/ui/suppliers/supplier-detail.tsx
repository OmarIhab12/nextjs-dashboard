// app/ui/suppliers/supplier-detail.tsx
'use client';

import ContactDetail, { type ContactData } from '../shared/contact-detail';
import { updateSupplierAction } from '@/app/lib/actions/suppliers';
import type { Supplier } from '@/app/lib/db/suppliers';

export default function SupplierDetail({ supplier }: { supplier: Supplier }) {
  const contact: ContactData = {
    id:      supplier.id,
    name:    supplier.name,
    email:   supplier.email   ?? null,
    phone:   supplier.phone   ?? null,
    address: supplier.address ?? null,
    city:    supplier.city    ?? null,
    country: supplier.country ?? null,
    notes:   supplier.notes   ?? null,
  };

  return (
    <ContactDetail
      contact={contact}
      title="Supplier Details"
      showNotes={true}
      onSave={async (id, input) => {
        const result = await updateSupplierAction(id, input);
        return result;
      }}
    />
  );
}
