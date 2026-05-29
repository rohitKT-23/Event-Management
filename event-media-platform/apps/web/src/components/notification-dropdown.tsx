'use client';

import Link from 'next/link';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  entityType: 'MEDIA' | 'EVENT' | 'ALBUM' | 'COMMENT';
  entityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor?: { username?: string; avatarUrl?: string | null } | null;
};

function notificationHref(n: Notification) {
  if (n.entityType === 'MEDIA') return `/media/${n.entityId}`;
  if (n.entityType === 'EVENT') return `/events/${n.entityId}`;
  return '/notifications';
}

export function NotificationDropdown() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications-summary'],
    queryFn: async () =>
      (await api.get('/users/me/notifications', { params: { page: 1, limit: 20 } })).data as {
        data: Notification[];
        unread: number;
      },
  });

  const markAll = useMutation({
    mutationFn: async () => api.patch('/users/me/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-summary'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  React.useEffect(() => {
    const onClickOutside = (ev: MouseEvent) => {
      if (!containerRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('click', onClickOutside);
    return () => document.removeEventListener('click', onClickOutside);
  }, [open]);

  const unread = data?.unread ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => setOpen((v) => !v)}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 max-w-[90vw] rounded-xl border bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-medium">Notifications</p>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAll.mutate()}
              disabled={!unread}
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {data?.data?.length ? (
              data.data.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`w-full border-b px-4 py-3 text-left last:border-0 ${
                    !n.isRead ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    setOpen(false);
                    router.push(notificationHref(n));
                  }}
                >
                  <p className="text-sm">
                    {n.actor?.username ? (
                      <>
                        <span className="font-medium">@{n.actor.username}</span> {n.message}
                      </>
                    ) : (
                      n.message
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                </button>
              ))
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            )}
          </div>

          <div className="border-t px-4 py-2 text-right">
            <Link href="/notifications" className="text-sm text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
