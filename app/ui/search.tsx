'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useDebouncedCallback } from 'use-debounce';

export default function Search({ placeholder }: { placeholder: string }) {
 

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  
    const handleSearch = useDebouncedCallback((term) => {
      const params = new URLSearchParams(searchParams);
      params.set('page', '1');
      if (term) {
        params.set('query', term);
      } else {
        params.delete('query');
      }

      replace(`${pathname}?${params.toString()}`);
    }, 300);

  return (
    <div className="relative flex-1">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        placeholder={placeholder}
        defaultValue={searchParams.get('query') ?? ''}
        onChange={(e) => handleSearch(e.target.value)}
        className="block w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
      />
    </div>
  );
}
