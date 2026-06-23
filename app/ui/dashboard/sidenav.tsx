import Link from 'next/link';
import NavLinks from '@/app/ui/dashboard/nav-links';
import VinslonLogo from '@/app/ui/vinslon-logo';
import { PowerIcon } from '@heroicons/react/24/outline';
import { signOut, auth } from '@/auth';

export default async function SideNav() {
  const session = await auth();
  return (
    <div className="flex min-h-full flex-col px-3 py-4 md:px-2">
      <Link
        className="mb-2 flex h-20 items-center justify-center rounded-md bg-gray-200 p-4 md:h-40"
        href="/dashboard"
      >
        <div className="w-32 md:w-44">
          <VinslonLogo />
        </div>
      </Link>
      {session?.user?.name && (
        <div className="mb-2 hidden items-center gap-2 rounded-md bg-yellow-100 px-3 py-2 md:flex">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold uppercase text-gray-600">
            {session.user.name.charAt(0)}
          </div>
          <span className="truncate text-sm font-medium text-gray-700">{session.user.name}</span>
        </div>
      )}
      <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
        {/* Mobile: horizontal scroll container. Desktop: md:contents makes this div transparent so links are direct flex children like the original. */}
        <div className="flex min-w-0 flex-1 flex-row gap-2 overflow-x-auto md:contents">
          <NavLinks role={session?.user?.role} />
        </div>
        <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block"></div>
        <form
          className="shrink-0"
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/dashboard' });
          }}
        >
          <button className="flex h-[48px] w-full items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-red-50 hover:text-red-700 md:flex-none md:justify-start md:p-2 md:px-3">
            <PowerIcon className="w-6" />
            <div className="hidden md:block">Sign Out</div>
          </button>
        </form>
      </div>
    </div>
  );
}
