'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, Users, ImageIcon, Album as AlbumIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api.get(`/events/${id}`)).data.event,
    enabled: !!id,
  });

  const media = useQuery({
    queryKey: ['event', id, 'media'],
    queryFn: async () => (await api.get(`/events/${id}/media`, { params: { limit: 24 } })).data,
    enabled: !!id,
  });

  if (event.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (event.isError || !event.data) return <p className="text-destructive">Event not found.</p>;

  const ev = event.data;
  return (
    <div className="space-y-8">
      <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/30">
        {ev.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ev.coverImageUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div>
        <div className="text-sm text-muted-foreground">{ev.club?.name}</div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{ev.name}</h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(ev.date).toLocaleDateString()}
          </span>
          {ev.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {ev.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ImageIcon className="h-4 w-4" />
            {ev._count?.media ?? 0} photos
          </span>
          <span className="flex items-center gap-1">
            <AlbumIcon className="h-4 w-4" />
            {ev._count?.albums ?? 0} albums
          </span>
        </div>
        {ev.description && <p className="mt-3 max-w-3xl text-muted-foreground">{ev.description}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Photos</h2>
        {media.isLoading ? (
          <p className="text-muted-foreground">Loading photos…</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {(media.data?.data ?? []).map((m: any) => (
              <Link key={m.id} href={`/media/${m.id}`} className="group">
                <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.thumbnailUrl}
                      alt={m.aiCaption ?? ''}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">
                      processing…
                    </div>
                  )}
                </div>
              </Link>
            ))}
            {!media.data?.data?.length && (
              <Card className="col-span-full">
                <CardContent className="grid place-items-center py-16 text-center">
                  <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No photos yet.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
