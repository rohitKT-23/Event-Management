'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Navbar } from '@/components/navbar';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { Loader2 } from 'lucide-react';

export default function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);

  const { data, isLoading, isError, isFetched } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data.user,
    staleTime: 60_000,
    retry: false,
  });

  React.useEffect(() => {
    if (data) setSession(data, null);
  }, [data, setSession]);

  React.useEffect(() => {
    if (isFetched && (isError || !data)) {
      clear();
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
    }
  }, [clear, data, isError, isFetched, pathname, router]);

  if (!isFetched || isLoading || !data) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container py-8">{children}</main>
      <KeyboardShortcuts />
    </div>
  );
}
