import { CheckIcon, ClockIcon, XCircleIcon, CalendarDaysIcon, ArrowDownOnSquareIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
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
          'bg-blue-500 text-white': status === 'confirmed',
          'bg-green-500 text-white': status === 'shipped',
        },
      )}
    >
      {status === 'draft' ? (
        <>
          Draft
          <RiDraftLine className="ml-1 w-4 text-gray-500" />
        </>
      ) : null}
      {status === 'shipped' ? (
        <>
          Shipped
          <ArrowUpTrayIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'confirmed' ? (
        <>
          Confirmed
          <RiCheckDoubleFill className="ml-1 w-4 text-white" />
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

export function OrderStatusUI({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-gray-100 text-gray-500': status === 'draft',
          'bg-blue-500 text-white': status === 'confirmed',
          'bg-purple-500 text-white': status === 'shipped',
          'bg-yellow-500 text-white': status === 'arrived',
          'bg-green-500 text-white': status === 'stored',
          'bg-red-500 text-white': status === 'cancelled',
        },
      )}
    >
      {status === 'draft' ? (
        <>
          Draft
          <RiDraftLine className="ml-1 w-4 text-gray-500" />
        </>
      ) : null}
      {status === 'confirmed' ? (
        <>
          Confirmed
          <RiCheckDoubleFill className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'shipped' ? (
        <>
          Shipped
          <ArrowUpTrayIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'arrived' ? (
        <>
          Arrived
          <CalendarDaysIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {status === 'stored' ? (
        <>
          Stored
          <ArrowDownOnSquareIcon className="ml-1 w-4 text-white" />
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
