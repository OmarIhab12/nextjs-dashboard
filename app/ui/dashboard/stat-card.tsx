// app/ui/dashboard/stat-card.tsx

import Link from 'next/link';
import type { ComponentType, CSSProperties, ReactNode } from 'react';

export type StatCardColor = 'gray' | 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'gold';

const COLORS: Record<StatCardColor, {
  card:  string;
  icon:  string;
  label: string;
  value: string;
  css?:  CSSProperties;
}> = {
  gray:   { card: 'border-gray-100 bg-gray-50 hover:bg-gray-100',       icon: 'text-gray-500',   label: 'text-gray-400',   value: 'text-gray-800'   },
  green:  { card: 'border-green-100 bg-green-50 hover:bg-green-100',     icon: 'text-green-500',  label: 'text-green-500',  value: 'text-green-700'  },
  red:    { card: 'border-red-100 bg-red-50 hover:bg-red-100',           icon: 'text-red-500',    label: 'text-red-400',    value: 'text-red-700'    },
  blue:   { card: 'border-blue-100 bg-blue-50 hover:bg-blue-100',        icon: 'text-blue-500',   label: 'text-blue-400',   value: 'text-blue-700'   },
  orange: { card: 'border-orange-100 bg-orange-50 hover:bg-orange-100',  icon: 'text-orange-500', label: 'text-orange-400', value: 'text-orange-700' },
  purple: { card: 'border-purple-100 bg-purple-50 hover:bg-purple-100',  icon: 'text-purple-500', label: 'text-purple-400', value: 'text-purple-700' },
  gold:   { card: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100',  icon: '', label: '', value: '', css: { color: '#C09300' } },
};

export type StatCardProps = {
  href:  string;
  icon:  ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  value: string;
  color?: StatCardColor;
  sub?:  ReactNode;
};

export default function StatCard({
  href, icon: Icon, title, value, color = 'gray', sub,
}: StatCardProps) {
  const c = COLORS[color];
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-xl border p-5 transition-colors ${c.card}`}
    >
      <div className="rounded-full bg-white p-3 shadow-sm flex-shrink-0">
        <Icon className={`h-5 w-5 ${c.icon}`} style={c.css} />
      </div>
      <div>
        <p className={`text-xs font-medium uppercase tracking-wide ${c.label}`} style={c.css}>
          {title}
        </p>
        <p className={`text-2xl font-bold tabular-nums ${c.value}`} style={c.css}>
          {value}
        </p>
        {sub}
      </div>
    </Link>
  );
}
