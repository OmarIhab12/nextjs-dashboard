import { CheckIcon, ClockIcon, XCircleIcon, CalendarDaysIcon, ArrowDownOnSquareIcon, ArrowUpTrayIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { MdDownloading } from "react-icons/md";
import { FcShipped } from "react-icons/fc";
import { RiDraftLine, RiCheckDoubleFill } from "react-icons/ri";
import { CiBank, CiMoneyCheck1  } from "react-icons/ci";
import { MdOutlinePhonelinkSetup } from "react-icons/md";
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
      {/* {status === 'cancelled' ? (
        <>
          Cancelled
          <XCircleIcon className="ml-1 w-4 text-white" />
        </>
      ) : null} */}
    </span>
  );
}

export function ExpensesTypeUI({ type }: { type: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-blue-500 text-white': type === 'operating',
          'bg-green-500 text-white': type === 'payroll',
          'bg-red-500 text-white': type === 'tax',
          'bg-gray-100 text-gray-500': type === 'other',
        },
      )}
    >
      {type === 'operating' ? (
        <>
          Operating
          <RiDraftLine className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {type === 'payroll' ? (
        <>
          Payroll
          <RiDraftLine className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {type === 'tax' ? (
        <>
          Tax
          <RiDraftLine className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {type === 'other' ? (
        <>
          Other
          <RiDraftLine className="ml-1 w-4 text-gray-500" />
        </>
      ) : null}
    </span>
  );
}

export function PayementMethodUI({ payment_method }: { payment_method: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-1 text-xs',
        {
          'bg-blue-500 text-white': payment_method === 'bank_transfer',
          'bg-green-500 text-white': payment_method === 'cash',
          'bg-purple-500 text-white': payment_method === 'check',
          'bg-red-500 text-white': payment_method === 'vodafone_cash',
        },
      )}
    >
      {payment_method === 'bank_transfer' ? (
        <>
          Bank Transfer
          <CiBank className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {payment_method === 'cash' ? (
        <>
          Cash
          <BanknotesIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {payment_method === 'check' ? (
        <>
          Check
          <CiMoneyCheck1  className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {payment_method === 'vodafone_cash' ? (
        <>
          Vodafone Cash
          <MdOutlinePhonelinkSetup className="ml-1 w-4 text-white" />
        </>
      ) : null}
    </span>
  );
}

export function BankAccounts({ account }: { account: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center rounded-full px-2 py-1 text-xs w-32 font-medium flex-shrink-0',
        {
          'bg-blue-300 text-white': account === 'bank_transfer',
          'bg-green-300 text-white': account === 'cash',
          'bg-purple-300 text-white': account === 'check',
          'bg-red-300 text-white': account === 'vodafone_cash',
        },
      )}
    >
      {account === 'bank_transfer' ? (
        <>
          Bank
          <CiBank  className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {account === 'cash' ? (
        <>
          Cash
          <BanknotesIcon className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {account === 'check' ? (
        <>
          Check
          <CiMoneyCheck1  className="ml-1 w-4 text-white" />
        </>
      ) : null}
      {account === 'vodafone_cash' ? (
        <>
          Vodafone Cash
          <MdOutlinePhonelinkSetup className="ml-1 w-4 text-white" />
        </>
      ) : null}
    </span>
  );
}
