'use client';

import Link from 'next/link';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { canManageContent, EVENT_CATEGORIES, prettyCategory } from '@/lib/permissions';
import { formatRelativeTime } from '@/lib/utils';

type SortKey = 'date' | 'name' | 'category';

export default function PublicEventsPage() {
  const user = useAuthStore((s) => s.user);
  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState<string>('');
  const [sort, setSort] = React.useState<SortKey>('date');

  const { data, isLoading } = useQuery({
    queryKey: ['public-events', { q, category }],
    queryFn: async () =>
      (
        await api.get('/events', {
          params: { q: q || undefined, category: category || undefined, limit: 48 },
        })
      ).data,
  });

  const events = React.useMemo(() => {
    const list = [...(data?.data ?? [])];
    list.sort((a: any, b: any) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'category') return String(a.category).localeCompare(String(b.category));
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    return list;
  }, [data, sort]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Browse events</h1>
          <p className="text-muted-foreground">Public events shared by clubs around you.</p>
        </div>
        {canManageContent(user) && (
          <Button asChild variant="gradient">
            <Link href="/events/new">
              <Plus className="mr-1 h-4 w-4" /> Create event
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-1 text-xs">
          <span className="px-1 text-muted-foreground">Sort:</span>
          {(['date', 'name', 'category'] as SortKey[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={
                'rounded px-2 py-1 capitalize transition ' +
                (sort === s ? 'bg-primary/10 text-primary' : 'hover:bg-accent')
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory('')}
          className={
            'rounded-full border px-3 py-1 text-xs transition ' +
            (category === '' ? 'border-primary bg-primary/10' : 'hover:bg-accent')
          }
        >
          All
        </button>
        {EVENT_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={
              'rounded-full border px-3 py-1 text-xs transition ' +
              (category === c ? 'border-primary bg-primary/10' : 'hover:bg-accent')
            }
          >
            {prettyCategory(c)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <div className="aspect-video animate-pulse bg-muted" />
              <CardContent className="space-y-2 p-4">
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No events match your filters</p>
            <p className="text-sm text-muted-foreground">Try clearing them or check back later.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((ev: any) => (
            <Link key={ev.id} href={`/events/${ev.id}`}>
              <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-violet-500/30 to-pink-500/30">
                  {ev.coverImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ev.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-xs backdrop-blur">
                    {prettyCategory(ev.category)}
                  </span>
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">
                    {ev.club?.name} • {formatRelativeTime(ev.date)}
                  </div>
                  <h3 className="mt-2 line-clamp-1 font-display text-lg font-semibold">{ev.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {ev.description ?? '—'}
                  </p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{ev._count?.media ?? 0} photos</span>
                    <span>•</span>
                    <span>{ev._count?.albums ?? 0} albums</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
