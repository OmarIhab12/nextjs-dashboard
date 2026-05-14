// app/ui/orders/buttons.tsx

import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link   from 'next/link';
import { deleteOrderAction } from '@/app/lib/actions/orders';

export function CreateOrder() {
  return (
    <Link href="/dashboard/orders/create" className="btn-primary">
      <PlusIcon className="h-4 w-4" />
      <span className="hidden md:block">Create Order</span>
    </Link>
  );
}

export function UpdateOrder({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/orders/${id}/edit`}
      className="btn-icon"
    >
      <PencilIcon className="w-4" />
    </Link>
  );
}

export function DeleteOrder({ id }: { id: string }) {
  const deleteWithId = deleteOrderAction.bind(null, id);
  return (
    <form action={deleteWithId}>
      <button type="submit" className="btn-danger">
        <span className="sr-only">Delete</span>
        <TrashIcon className="w-4" />
      </button>
    </form>
  );
}