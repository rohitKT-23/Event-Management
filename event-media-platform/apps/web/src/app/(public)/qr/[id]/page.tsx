'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

/**
 * QR landing page. A scanned QR points here; we resolve the id as an album or
 * an event, show a quick preview, then auto-redirect after a short countdown.
 */
export default function QRLandingPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [countdown, setCountdown] = React.useState(2);

  const resolved = useQuery({
    queryKey: ['qr-resolve', id],
    queryFn: async () => {
      try {
        const album = (await api.get(`/albums/${id}`)).data.album;
        return { kind: 'album' as const, name: album.name, cover: album.coverImageUrl, href: `/albums/${id}` };
      } catch {
        const event = (await api.get(`/events/${id}`)).data.event;
        return { kind: 'event' as const, name: event.name, cover: event.coverImageUrl, href: `/events/${id}` };
      }
    },
    enabled: !!id,
    retry: false,
  });

  React.useEffect(() => {
    if (!resolved.data) return;
    if (countdown <= 0) {
      router.replace(resolved.data.href as any);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, resolved.data, router]);

  return (
    <div className="grid min-h-[60vh] place-items-center">
      <Card className="w-full max-w-md overflow-hidden text-center">
        <div className="relative aspect-video bg-gradient-to-br from-violet-500/30 to-pink-500/30">
          {resolved.data?.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolved.data.cover} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <CardContent className="space-y-3 py-8">
          {resolved.isLoading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : resolved.isError ? (
            <p className="text-destructive">This link is no longer available.</p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold tracking-tight">{resolved.data?.name}</h1>
              <p className="text-sm text-muted-foreground">Tap to view {resolved.data?.kind}</p>
              <button
                onClick={() => router.replace((resolved.data?.href ?? '/') as any)}
                className="rounded-full bg-gradient-to-r from-violet-600 to-pink-600 px-5 py-2 text-sm font-medium text-white"
              >
                Open now
              </button>
              <p className="text-xs text-muted-foreground">Redirecting in {countdown}s…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
