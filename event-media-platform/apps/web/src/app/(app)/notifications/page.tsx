'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/users/me/notifications', { params: { limit: 50 } })).data,
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/users/me/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">{data?.unread ?? 0} unread</p>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()} disabled={!data?.unread}>
          <CheckCheck className="mr-2 h-4 w-4" />
          Mark all read
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data?.data?.length ? (
        <div className="space-y-2">
          {data.data.map((n: any) => (
            <Card key={n.id} className={n.isRead ? 'opacity-70' : 'border-primary/40'}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{n.actor?.username ?? 'Someone'}</span> {n.message}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
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
