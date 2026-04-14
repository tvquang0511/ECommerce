'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const navItems = [
  {
    href: '/account/profile',
    label: 'Hồ sơ',
    tone: 'from-blue-500 to-cyan-500',
  },
  {
    href: '/account/security',
    label: 'Bảo mật',
    tone: 'from-rose-500 to-orange-500',
  },
  {
    href: '/account/two-factor',
    label: '2FA',
    tone: 'from-lime-500 to-emerald-500',
  },
  {
    href: '/account/sessions',
    label: 'Phiên',
    tone: 'from-violet-500 to-fuchsia-500',
  },
];

export function AccountQuickNav() {
  const pathname = usePathname();

  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-4">
      {navItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative inline-flex h-10 items-center justify-center overflow-hidden rounded-lg border text-sm font-medium transition hover:-translate-y-0.5',
              active
                ? 'border-transparent text-white shadow-md'
                : 'border-border bg-white/85 text-foreground hover:border-white/70',
            )}
          >
            {active ? <span className={cn('absolute inset-0 bg-linear-to-r', item.tone)} /> : null}
            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
