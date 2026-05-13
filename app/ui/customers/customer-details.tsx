// app/ui/customers/customer-details.tsx
'use client';

import ContactDetail, { type ContactData } from '../shared/contact-detail';
import { updateCustomerAction } from '@/app/lib/actions/customers';
import type { Customer } from '@/app/lib/db/customers';

export default function CustomerDetail({ customer }: { customer: Customer }) {
  const contact: ContactData = {
    id:      customer.id,
    name:    customer.name,
    email:   customer.email   ?? null,
    phone:   customer.phone   ?? null,
    address: customer.address ?? null,
    city:    customer.city    ?? null,
    country: customer.country ?? null,
  };

  return (
    <ContactDetail
      contact={contact}
      title="Customer Details"
      showNotes={false}
      onSave={async (id, input) => {
        const result = await updateCustomerAction(id, input);
        return result;
      }}
    />
  );
}