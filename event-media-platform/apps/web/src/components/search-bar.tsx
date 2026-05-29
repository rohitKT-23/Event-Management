'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Clock, Hash } from 'lucide-react';
import { api } from '@/lib/api';

const RECENT_KEY = 'emp-recent-searches';
const TRENDING_TAGS = ['sunset', 'portrait', 'crowd', 'stage', 'group', 'candid'];

function getRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function pushRecent(term: string) {
  const list = [term, ...getRecent().filter((t) => t !== term)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [recent, setRecent] = React.useState<string[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = setTimeout(() => setDebounced(value.trim()), 400);
    return () => clearTimeout(h);
  }, [value]);

  React.useEffect(() => {
    if (open) setRecent(getRecent());
  }, [open]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const enabled = open && debounced.length >= 2;
  const events = useQuery({
    queryKey: ['quick-search', 'event', debounced],
    enabled,
    queryFn: async () => (await api.get('/search', { params: { type: 'event', q: debounced, limit: 3 } })).data.data as any[],
  });
  const media = useQuery({
    queryKey: ['quick-search', 'media', debounced],
    enabled,
    queryFn: async () => (await api.get('/search', { params: { type: 'media', q: debounced, limit: 3 } })).data.data as any[],
  });
  const users = useQuery({
    queryKey: ['quick-search', 'user', debounced],
    enabled,
    queryFn: async () => (await api.get('/search', { params: { type: 'user', q: debounced, limit: 2 } })).data.data as any[],
  });

  const go = (term: string) => {
    if (!term.trim()) return;
    pushRecent(term.trim());
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <div ref={ref} className="relative hidden flex-1 sm:block sm:max-w-xs">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && go(value)}
        placeholder="Search events, photos, people…"
        className="h-9 w-full rounded-full border bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] w-[min(28rem,90vw)] overflow-y-auto rounded-xl border bg-background p-2 shadow-xl">
          {debounced.length < 2 ? (
            <div className="space-y-3 p-2">
              {recent.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" /> Recent
                  </p>
                  {recent.map((r) => (
                    <button key={r} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => go(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Hash className="h-3 w-3" /> Trending tags
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TRENDING_TAGS.map((t) => (
                    <button key={t} className="rounded-full bg-secondary px-2 py-0.5 text-xs hover:bg-accent" onClick={() => go(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {events.data?.length ? (
                <div>
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Events</p>
                  {events.data.map((e) => (
                    <Link key={e.id} href={`/events/${e.id}`} className="block rounded px-2 py-1.5 text-sm hover:bg-accent" onClick={() => setOpen(false)}>
                      {e.name}
                    </Link>
                  ))}
                </div>
              ) : null}
              {media.data?.length ? (
                <div>
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Photos & videos</p>
                  <div className="flex gap-2 px-2">
                    {media.data.map((m) => (
                      <Link key={m.id} href={`/media/${m.id}`} className="block h-16 w-16 overflow-hidden rounded bg-secondary" onClick={() => setOpen(false)}>
                        {m.thumbnailUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
              {users.data?.length ? (
                <div>
                  <p className="px-2 py-1 text-xs font-medium text-muted-foreground">People</p>
                  {users.data.map((u) => (
                    <Link key={u.id} href={`/u/${u.username}`} className="block rounded px-2 py-1.5 text-sm hover:bg-accent" onClick={() => setOpen(false)}>
                      @{u.username}
                    </Link>
                  ))}
                </div>
              ) : null}
              <button className="w-full rounded bg-primary/10 px-2 py-2 text-center text-sm font-medium text-primary hover:bg-primary/20" onClick={() => go(value)}>
                View all results for “{debounced}”
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
