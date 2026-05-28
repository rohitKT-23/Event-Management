'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Camera, Heart, Sparkles, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth';
import { formatRelativeTime } from '@/lib/utils';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const events = useQuery({
    queryKey: ['events', 'recent'],
    queryFn: async () => (await api.get('/events', { params: { limit: 6 } })).data,
  });
  const uploads = useQuery({
    queryKey: ['me', 'uploads'],
    queryFn: async () => (await api.get('/users/me/uploads', { params: { limit: 4 } })).data,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Welcome back{user?.username ? `, ${user.username}` : ''}.
          </h1>
          <p className="text-muted-foreground">Here's what's new across your clubs and events.</p>
        </div>
        <Button asChild variant="gradient">
          <Link href="/upload"><Upload className="mr-2 h-4 w-4" /> Upload media</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Camera} label="My uploads" value={uploads.data?.total ?? '—'} href="/profile" />
        <StatCard icon={Heart} label="Favourites" value="—" href="/favourites" />
        <StatCard icon={Calendar} label="Events" value={events.data?.total ?? '—'} href="/events" />
        <StatCard icon={Sparkles} label="My photos" value="—" href="/my-photos" />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Recent events</h2>
          <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        {events.isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(events.data?.data ?? []).map((ev: any) => (
              <Link key={ev.id} href={`/events/${ev.id}`}>
                <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="aspect-video bg-gradient-to-br from-violet-500/20 to-pink-500/20" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-secondary px-2 py-0.5">{ev.category}</span>
                      <span>{formatRelativeTime(ev.date)}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 font-medium">{ev.name}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {ev.club?.name} • {ev._count?.media ?? 0} photos
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {!events.data?.data?.length && (
              <EmptyState
                icon={Calendar}
                title="No events yet"
                body="When clubs you follow create events, they'll appear here."
              />
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Your recent uploads</h2>
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </div>
        {uploads.isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(uploads.data?.data ?? []).map((m: any) => (
              <Link key={m.id} href={`/media/${m.id}`}>
                <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      processing…
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {!uploads.data?.data?.length && (
              <EmptyState icon={Upload} title="No uploads yet" body="Drop some photos to get started." />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, href }: any) {
  return (
    <Link href={href}>
      <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-semibold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="aspect-video animate-pulse bg-muted" />
          <CardContent className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: any) {
  return (
    <Card className="col-span-full">
      <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
        <Icon className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
