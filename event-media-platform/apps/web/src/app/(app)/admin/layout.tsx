'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/media', label: 'Moderation' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = useAuthStore((s) => s.user);
  const pathname = usePathname();

  if (me && me.role !== 'ADMIN') {
    return (
      <div className="space-y-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Admins only</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to view this area.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to feed</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Manage users, moderate media, and watch platform health.</p>
      </div>
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => {
          const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-violet-600 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
