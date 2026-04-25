'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/prompts', label: 'Prompts' },
  { href: '/logs', label: 'Logs' },
  { href: '/traces', label: 'Traces' },
  { href: '/runs', label: 'Runs' },
  { href: '/labels', label: 'Labels' },
  { href: '/settings', label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      <div className="px-4 py-6">
        <h1 className="text-lg font-semibold tracking-tight">PromptMetrics</h1>
        <p className="text-xs text-zinc-500 mt-1">Dashboard</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ` +
                (active
                  ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100')
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
