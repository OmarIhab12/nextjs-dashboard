import { CheckIcon, ClockIcon, XCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { MdDownloading } from "react-icons/md";
import { FcShipped } from "react-icons/fc";
import { RiDraftLine, RiCheckDoubleFill } from "react-icons/ri";
import clsx from 'clsx';

export function InvoiceStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-gray-100 text-gray-500': status === 'draft',
          'bg-orange-500 text-white': status === 'confirmed',
          'bg-red-500 text-white': status === 'cancelled',
          'bg-green-500 text-white': status === 'shipped',
        },
      )}
    >
      {status === 'draft' ? (
        <>
          Pending
          <RiDraftLine className="ml-1 w-4 text-gray-500" />
        </>
      ) : null}
      {status === 'shipped' ? (
        <>
          Shipped
          <FcShipped className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'confirmed' ? (
        <>
          Confirmed
          <CheckIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'cancelled' ? (
        <>
          Cancelled
          <XCircleIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
    </span>
  );
}

export function PaymentStatus({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-gray-100 text-gray-500': status === 'pending',
          'bg-yellow-500 text-white': status === 'partial',
          'bg-green-500 text-white': status === 'paid',
          'bg-red-500 text-white': status === 'overdue',
        },
      )}
    >
      {status === 'pending' ? (
        <>
          Pending
          <ClockIcon className="ml-1 w-4 text-gray-500" />
        </>
      ) : null}
      {status === 'paid' ? (
        <>
          Paid
          <RiCheckDoubleFill className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'partial' ? (
        <>
          Partial
          <MdDownloading className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'overdue' ? (
        <>
          Overdue
          <CalendarDaysIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
    </span>
  );
}
