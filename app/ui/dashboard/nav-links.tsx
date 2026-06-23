'use client';

import {
  UserGroupIcon,
  HomeIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  ShoppingCartIcon,
  BuildingStorefrontIcon,
  BanknotesIcon,
  WalletIcon,
  ScaleIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

// Map of links to display in the side navigation.
// Depending on the size of the application, this would be stored in a database.
const MANAGER_PATHS = new Set([
  '/dashboard/suppliers',
  '/dashboard/orders',
  '/dashboard/expenses',
  '/dashboard/wallet',
  '/dashboard/transactions',
]);

const links = [
  { name: 'Home',      href: '/dashboard',           icon: HomeIcon              },
  { name: 'Invoices',  href: '/dashboard/invoices',  icon: DocumentDuplicateIcon },
  { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon         },
  { name: 'Balances',  href: '/dashboard/balances',  icon: ScaleIcon             },
  { name: 'Products',  href: '/dashboard/products',  icon: ArchiveBoxIcon        },
  { name: 'Suppliers', href: '/dashboard/suppliers', icon: BuildingStorefrontIcon},
  { name: 'Orders',    href: '/dashboard/orders',    icon: ShoppingCartIcon      },
  { name: 'Expenses',  href: '/dashboard/expenses',  icon: BanknotesIcon         },
  { name: 'Transactions',  href: '/dashboard/transactions',  icon: ArrowsRightLeftIcon   },
  { name: 'Wallet',        href: '/dashboard/wallet',        icon: WalletIcon            },
];

export default function NavLinks({ role }: { role?: string }) {
  const canSeeAll = role === 'admin' || role === 'manager';
  const pathname  = usePathname();
  const visible   = canSeeAll ? links : links.filter(l => !MANAGER_PATHS.has(l.href));
  return (
    <>
      {visible.map((link) => {
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.name}
            href={link.href}
            className={clsx(
              'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-red-50 hover:text-red-700 md:flex-none md:justify-start md:p-2 md:px-3',
              {
                'bg-red-200 text-red-800':
                  link.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(link.href),
              },
            )}
          >
            <LinkIcon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}
