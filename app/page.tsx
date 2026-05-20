import VinslonLogo from '@/app/ui/vinslon-logo';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-8">
        <div className="w-full rounded-xl bg-blue-600 p-6">
          <VinslonLogo />
        </div>
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <span>Log in</span>
          <ArrowRightIcon className="w-5" />
        </Link>
      </div>
    </main>
  );
}
