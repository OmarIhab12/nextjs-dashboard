import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { deleteInvoice } from '@/app/lib/db/invoices';

export function CreateInvoice() {
  return (
    <Link
      href="/dashboard/invoices/create"
      className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <span className="hidden md:block">Create Invoice</span>{' '}
      <PlusIcon className="h-5 md:ml-4" />
    </Link>
  );
}

export function UpdateInvoice({ id }: { id: string }) {
  return (
    <Link
      href={`/dashboard/invoices/${id}/edit`}
      className="rounded-md p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
    >
      <PencilIcon className="w-4" />
    </Link>
  );
}

export function DeleteInvoice({ id }: { id: string }) {
  const deleteInvoiceWithId = deleteInvoice.bind(null, id);
  return (
    <>
    <form action={deleteInvoiceWithId}>
      <button type="submit" className="rounded-md p-1.5 bg-red-50 text-red-500 hover:bg-red-100 disabled:opacity-50 transition-colors">
        <span className="sr-only">Delete</span>
        <TrashIcon className="w-4" />
      </button>
      </form>
    </>
  );
}
