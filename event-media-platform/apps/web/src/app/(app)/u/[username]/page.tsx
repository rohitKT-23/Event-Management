'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Camera, ImageIcon, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InfiniteGallery } from '@/components/infinite-gallery';
import { Lightbox } from '@/components/lightbox';
import { formatRelativeTime } from '@/lib/utils';
import { formatUserRole } from '@/lib/auth-routes';

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params.username;
  const me = useAuthStore((s) => s.user);
  const isOwn = me?.username === username;

  const [tab, setTab] = React.useState<'uploads' | 'favourites'>('uploads');
  const [items, setItems] = React.useState<any[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  // Resolve the user via the search endpoint (exact username match), then fetch
  // the full public profile (joined date) by id.
  const resolved = useQuery({
    queryKey: ['user-by-username', username],
    queryFn: async () => {
      const list = (await api.get('/search', { params: { type: 'user', q: username, limit: 10 } })).data.data as any[];
      return list.find((u) => u.username?.toLowerCase() === username.toLowerCase()) ?? null;
    },
  });

  const userId = resolved.data?.id;
  const profile = useQuery({
    queryKey: ['public-user', userId],
    enabled: !!userId,
    queryFn: async () => (await api.get(`/users/${userId}`)).data.user,
  });

  const fetchUploads = React.useCallback(
    async (page: number) => {
      if (isOwn) {
        const res = (await api.get('/users/me/uploads', { params: { page, limit: 24 } })).data;
        return { data: res.data as any[], nextPage: res.hasMore ? page + 1 : null };
      }
      const res = (await api.get('/search', { params: { type: 'media', q: username, page, limit: 24 } })).data;
      const data = (res.data as any[]).filter((m) => m.uploader?.username?.toLowerCase() === username.toLowerCase());
      return { data, nextPage: res.hasMore ? page + 1 : null };
    },
    [isOwn, username],
  );

  const fetchFavourites = React.useCallback(async (page: number) => {
    const res = (await api.get('/users/me/favourites', { params: { page, limit: 24 } })).data;
    return { data: res.data as any[], nextPage: res.hasMore ? page + 1 : null };
  }, []);

  if (resolved.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!resolved.data) return <p className="text-destructive">User @{username} not found.</p>;

  const u = profile.data ?? resolved.data;
  const isPhotographer = u.role === 'PHOTOGRAPHER';

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-2xl font-bold text-white">
            {u.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              u.username.slice(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">@{u.username}</h1>
            <p className="text-sm text-muted-foreground">{formatUserRole(u.role)}</p>
            {u.bio && <p className="mt-1 max-w-lg text-sm text-muted-foreground">{u.bio}</p>}
            {u.createdAt && (
              <p className="mt-1 text-xs text-muted-foreground">Joined {formatRelativeTime(u.createdAt)}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isPhotographer && (
            <Button asChild variant="outline">
              <Link href={`/photographer/${u.username}`}>
                <Camera className="mr-1 h-4 w-4" /> Portfolio
              </Link>
            </Button>
          )}
          {isOwn && (
            <Button asChild variant="gradient">
              <Link href="/profile/edit">
                <Pencil className="mr-1 h-4 w-4" /> Edit profile
              </Link>
            </Button>
          )}
        </div>
      </div>

      {isOwn && (
        <div className="flex gap-1 border-b">
          {(['uploads', 'favourites'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'border-b-2 px-4 py-2 text-sm capitalize transition ' +
                (tab === t ? 'border-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <InfiniteGallery<any>
        queryKey={['profile-media', username, isOwn ? tab : 'uploads']}
        fetchPage={tab === 'favourites' && isOwn ? fetchFavourites : fetchUploads}
        onItems={setItems}
        emptyState={
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
            </CardContent>
          </Card>
        }
        renderItem={(m, i) => (
          <button
            key={m.id}
            onClick={() => setLightboxIndex(i)}
            className="group block aspect-square overflow-hidden rounded-lg bg-secondary"
          >
            {m.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.thumbnailUrl} alt={m.aiCaption ?? ''} className="h-full w-full object-cover transition group-hover:scale-105" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">processing…</div>
            )}
          </button>
        )}
      />

      {lightboxIndex !== null && items.length > 0 && (
        <Lightbox items={items} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}
