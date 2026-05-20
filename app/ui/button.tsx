'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export function Button({ children, className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'flex h-10 items-center rounded-lg bg-blue-500 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:bg-blue-600 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
  );
}

type PriceListMode = 'active' | 'active&available' | 'all';

const PRICE_LIST_CONFIG: Record<PriceListMode, { url: string; label: string; suffix: string }> = {
  'active':           { url: '/api/products/pdf',             label: 'Active PDF',              suffix: 'active'    },
  'active&available': { url: '/api/products/pdf?available=1', label: 'Active & In Stock PDF',   suffix: 'available' },
  'all':              { url: '/api/products/pdf?all=1',       label: 'All PDF',                 suffix: 'all'       },
};

export function DownloadPriceListButton({ mode = 'active' }: { mode?: PriceListMode }) {
  const [loading, setLoading] = useState(false);
  const config = PRICE_LIST_CONFIG[mode];

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(config.url);
      if (!res.ok) throw new Error('Failed to generate price list PDF');

      const blob      = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a         = document.createElement('a');
      a.href          = objectUrl;
      a.download      = `vinslon-price-list-${config.suffix}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء إنشاء قائمة الأسعار');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
      {loading ? 'Generating...' : config.label}
    </button>
  );
}

interface Props {
  invoiceId: string;
  iconOnly?: boolean;
}

export function DownloadPDFButton({ invoiceId, iconOnly = false }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error('Failed to generate PDF');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate price list PDF');
    } finally {
      setLoading(false);
    }
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        title="PDF"
        className="rounded-md border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex h-10 items-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
      {loading ? 'Downloading...' : 'PDF'}
    </button>
  );
}
