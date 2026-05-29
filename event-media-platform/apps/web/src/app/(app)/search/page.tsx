'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InfiniteGallery } from '@/components/infinite-gallery';
import { formatRelativeTime } from '@/lib/utils';
import { prettyCategory } from '@/lib/permissions';

type TypeFilter = 'all' | 'photos' | 'videos' | 'events' | 'users';

function SearchInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [q, setQ] = React.useState(sp.get('q') ?? '');
  const [type, setType] = React.useState<TypeFilter>((sp.get('type') as TypeFilter) ?? 'all');
  const [dateFrom, setDateFrom] = React.useState(sp.get('date_from') ?? '');
  const [dateTo, setDateTo] = React.useState(sp.get('date_to') ?? '');
  const [uploader, setUploader] = React.useState(sp.get('uploader') ?? '');
  const [tags, setTags] = React.useState<string[]>((sp.get('tags') ?? '').split(',').filter(Boolean));
  const [tagInput, setTagInput] = React.useState('');
  const [debounced, setDebounced] = React.useState(q);
  const [showAllEvents, setShowAllEvents] = React.useState(false);

  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(h);
  }, [q]);

  // Sync filters → URL (shareable).
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debounced) params.set('q', debounced);
    if (type !== 'all') params.set('type', type);
    if (tags.length) params.set('tags', tags.join(','));
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    if (uploader) params.set('uploader', uploader);
    router.replace(`/search${params.toString() ? `?${params}` : ''}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, type, tags, dateFrom, dateTo, uploader]);

  const commonParams = {
    q: debounced || undefined,
    tags: tags.length ? tags.join(',') : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    uploader: uploader || undefined,
  };

  const showEvents = type === 'all' || type === 'events';
  const showUsers = type === 'all' || type === 'users';
  const showMedia = type === 'all' || type === 'photos' || type === 'videos';

  const events = useQuery({
    queryKey: ['search', 'event', commonParams],
    enabled: showEvents,
    queryFn: async () => (await api.get('/search', { params: { ...commonParams, type: 'event', limit: 12 } })).data.data as any[],
  });

  const users = useQuery({
    queryKey: ['search', 'user', commonParams],
    enabled: showUsers,
    queryFn: async () => (await api.get('/search', { params: { ...commonParams, type: 'user', limit: 12 } })).data.data as any[],
  });

  const mediaFetch = React.useCallback(
    async (page: number) => {
      const res = (await api.get('/search', { params: { ...commonParams, type: 'media', page, limit: 24 } })).data;
      let data = res.data as any[];
      if (type === 'photos') data = data.filter((m) => m.type === 'PHOTO');
      if (type === 'videos') data = data.filter((m) => m.type === 'VIDEO');
      return { data, nextPage: res.hasMore ? page + 1 : null };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(commonParams), type],
  );

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Filters */}
      <aside className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Search</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" autoFocus />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Type</Label>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'photos', 'videos', 'events', 'users'] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={
                  'rounded-full border px-3 py-1 text-xs capitalize transition ' +
                  (type === t ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Date range</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Tags</Label>
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Type a tag, press Enter"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
                  {t}
                  <button onClick={() => setTags((p) => p.filter((x) => x !== t))} aria-label="Remove tag">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Uploader</Label>
          <Input value={uploader} onChange={(e) => setUploader(e.target.value)} placeholder="username" />
        </div>
      </aside>

      {/* Results */}
      <div className="space-y-8">
        {showEvents && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Events</h2>
              {(events.data?.length ?? 0) > 4 && (
                <button className="text-xs text-primary hover:underline" onClick={() => setShowAllEvents((v) => !v)}>
                  {showAllEvents ? 'Show less' : 'See all'}
                </button>
              )}
            </div>
            {events.data?.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(showAllEvents ? events.data : events.data.slice(0, 4)).map((e) => (
                  <Link key={e.id} href={`/events/${e.id}`}>
                    <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="relative aspect-video bg-gradient-to-br from-violet-500/30 to-pink-500/30">
                        {e.coverImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.coverImageUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h3 className="line-clamp-1 text-sm font-medium">{e.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {prettyCategory(e.category)} • {formatRelativeTime(e.date)}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No events found for this query.</p>
            )}
          </section>
        )}

        {showMedia && (
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Photos &amp; videos</h2>
            <InfiniteGallery<any>
              queryKey={['search', 'media', commonParams, type]}
              fetchPage={mediaFetch}
              emptyState={<p className="text-sm text-muted-foreground">No media found for this query.</p>}
              renderItem={(m) => (
                <Link key={m.id} href={`/media/${m.id}`} className="group block aspect-square overflow-hidden rounded-lg bg-secondary">
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnailUrl} alt={m.aiCaption ?? ''} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">processing…</div>
                  )}
                </Link>
              )}
            />
          </section>
        )}

        {showUsers && (
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">People</h2>
            {users.data?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {users.data.map((u) => (
                  <Link key={u.id} href={`/u/${u.username}`}>
                    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                      <CardContent className="flex flex-col items-center gap-2 py-5 text-center">
                        <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-sm font-bold text-white">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            u.username.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="line-clamp-1 text-sm font-medium">@{u.username}</span>
                        <span className="text-xs capitalize text-muted-foreground">{String(u.role).toLowerCase()}</span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No people found for this query.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense fallback={<p className="text-muted-foreground">Loading search…</p>}>
      <SearchInner />
    </React.Suspense>
  );
}
