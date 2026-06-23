import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import VinslonLogo from '@/app/ui/vinslon-logo';
import { PowerIcon } from '@heroicons/react/24/outline';
import { signOut, auth } from '@/auth';

export default async function SideNav() {
  const session = await auth();
  return (
    <div className="flex h-full flex-col px-3 py-4 md:px-2">
      <Link
        className="mb-2 flex h-20 items-center justify-center rounded-md bg-gray-200 p-4 md:h-40"
        href="/dashboard"
      >
        <div className="w-32 md:w-44">
          <VinslonLogo />
        </div>
      </Link>
      {session?.user?.name && (
        <div className="mb-2 hidden items-center gap-2 rounded-md bg-gray-50 px-3 py-2 md:flex">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold uppercase text-gray-600">
            {session.user.name.charAt(0)}
          </div>
          <span className="truncate text-sm font-medium text-gray-700">{session.user.name}</span>
        </div>
      )}
      <div className="flex grow flex-row items-center justify-between gap-2 md:flex-col md:items-stretch md:justify-start md:gap-0 md:space-y-2">
        {/* Scrollable nav links — horizontal scroll on mobile, vertical scroll on desktop */}
        <div className="flex min-w-0 shrink flex-row gap-2 overflow-x-auto md:min-h-0 md:flex-1 md:flex-col md:gap-2 md:overflow-x-hidden md:overflow-y-auto">
          <NavLinks role={session?.user?.role} />
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/dashboard' });
          }}
        >
          <button className="flex h-[48px] shrink-0 items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-red-50 hover:text-red-700 md:w-full md:flex-none md:justify-start md:p-2 md:px-3">
            <PowerIcon className="w-6" />
            <div className="hidden md:block">Sign Out</div>
          </button>
        </form>
      </div>
    </div>
  );
}
