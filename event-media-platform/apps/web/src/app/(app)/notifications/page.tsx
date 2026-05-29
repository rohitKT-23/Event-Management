'use client';

import * as React from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';

type NotificationTypeFilter = 'ALL' | 'LIKE' | 'COMMENT' | 'TAG' | 'UPLOAD';
type Notification = {
  id: string;
  type: string;
  entityType: 'MEDIA' | 'EVENT' | 'ALBUM' | 'COMMENT';
  entityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor?: { id: string; username: string; avatarUrl?: string | null } | null;
};

const FILTERS: NotificationTypeFilter[] = ['ALL', 'LIKE', 'COMMENT', 'TAG', 'UPLOAD'];

function notificationHref(n: Notification) {
  if (n.entityType === 'MEDIA') return `/media/${n.entityId}`;
  if (n.entityType === 'EVENT') return `/events/${n.entityId}`;
  return '/notifications';
}

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<NotificationTypeFilter>('ALL');

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam = 1 }) =>
      (
        await api.get('/users/me/notifications', {
          params: { page: pageParam, limit: 20 },
        })
      ).data,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/users/me/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const allItems = React.useMemo(
    () => (data?.pages ?? []).flatMap((p: any) => p.data as Notification[]),
    [data?.pages],
  );
  const unread = data?.pages?.[0]?.unread ?? 0;
  const items = allItems.filter((n) => (filter === 'ALL' ? true : n.type === filter));

  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) fetchNextPage();
    });
    obs.observe(node);
    return () => obs.disconnect();
  }, [fetchNextPage, hasNextPage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">{unread} unread</p>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()} disabled={!unread}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all read
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              'rounded-full border px-3 py-1 text-xs transition ' +
              (filter === f ? 'border-primary bg-primary/10' : 'hover:bg-accent')
            }
          >
            {f === 'ALL' ? 'All' : f.toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length ? (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className={n.isRead ? 'opacity-70' : 'border-primary/40'}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <Link href={notificationHref(n)} className="block">
                    <p className="text-sm">
                      <span className="font-medium">{n.actor?.username ?? 'Someone'}</span> {n.message}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          <div ref={loadMoreRef} />
          {isFetchingNextPage && <p className="text-sm text-muted-foreground">Loading more…</p>}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">You're all caught up</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
