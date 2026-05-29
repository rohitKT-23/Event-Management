'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Settings, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import { prettyCategory } from '@/lib/permissions';

type Tab = 'events' | 'members' | 'about';

export default function ClubDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = React.useState<Tab>('events');

  const club = useQuery({
    queryKey: ['club', id],
    queryFn: async () => (await api.get(`/clubs/${id}`)).data.club,
    enabled: !!id,
  });

  const events = useQuery({
    queryKey: ['club', id, 'events'],
    queryFn: async () => (await api.get('/events', { params: { clubId: id, limit: 48 } })).data.data as any[],
    enabled: !!id && tab === 'events',
  });

  const members = useQuery({
    queryKey: ['club', id, 'members'],
    queryFn: async () => (await api.get(`/clubs/${id}/members`)).data.members as any[],
    enabled: !!id,
  });

  if (club.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (club.isError || !club.data) return <p className="text-destructive">Club not found.</p>;

  const c = club.data;
  const myMembership = members.data?.find((m) => m.user?.id === user?.id);
  const canManage = user?.role === 'ADMIN' || myMembership?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-pink-500 text-2xl font-bold text-white">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              c.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-sm text-muted-foreground">
              {c._count?.memberships ?? 0} members • {c._count?.events ?? 0} events
            </p>
          </div>
        </div>
        {canManage && (
          <Button asChild variant="outline">
            <Link href={`/clubs/${id}/manage`}>
              <Settings className="mr-1 h-4 w-4" /> Manage
            </Link>
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b">
        {(['events', 'members', 'about'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              'border-b-2 px-4 py-2 text-sm capitalize transition ' +
              (tab === t ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        events.isLoading ? (
          <p className="text-muted-foreground">Loading events…</p>
        ) : events.data?.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.data.map((ev) => (
              <Link key={ev.id} href={`/events/${ev.id}`}>
                <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-video bg-gradient-to-br from-violet-500/30 to-pink-500/30">
                    {ev.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ev.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs backdrop-blur">
                      {prettyCategory(ev.category)}
                    </span>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="line-clamp-1 font-medium">{ev.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(ev.date)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="grid place-items-center gap-2 py-12 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No events yet.</p>
            </CardContent>
          </Card>
        )
      )}

      {tab === 'members' && (
        members.isLoading ? (
          <p className="text-muted-foreground">Loading members…</p>
        ) : (
          <div className="grid gap-2">
            {(members.data ?? []).map((m) => (
              <Card key={m.user?.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-xs font-bold text-white">
                    {m.user?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      m.user?.username?.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <Link href={`/u/${m.user?.username}`} className="flex-1 font-medium hover:underline">
                    @{m.user?.username}
                  </Link>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {m.role === 'ADMIN' ? 'Club admin' : 'Member'}
                  </span>
                </CardContent>
              </Card>
            ))}
            {!members.data?.length && (
              <Card>
                <CardContent className="grid place-items-center gap-2 py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )
      )}

      {tab === 'about' && (
        <Card>
          <CardContent className="space-y-3 py-6 text-sm">
            <p className="text-muted-foreground">{c.description || 'No description provided.'}</p>
            <div className="text-xs text-muted-foreground">
              Created {formatRelativeTime(c.createdAt)}
              {c.createdBy?.username && <> • by @{c.createdBy.username}</>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
