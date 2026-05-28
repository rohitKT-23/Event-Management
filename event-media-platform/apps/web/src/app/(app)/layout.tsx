'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Navbar } from '@/components/navbar';
import { Loader2 } from 'lucide-react';

export default function AuthenticatedAppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const storedUser = useAuthStore((s) => s.user);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data.user,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (data) setSession(data, null);
  }, [data, setSession]);

  React.useEffect(() => {
    if (!isLoading && isError && !storedUser) router.replace('/login');
  }, [isError, isLoading, router, storedUser]);

  if (isLoading && !storedUser) {
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
    </div>
  );
}
