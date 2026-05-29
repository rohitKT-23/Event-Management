'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { GeoMedia } from '@/components/photo-map';

const PhotoMap = dynamic(() => import('@/components/photo-map'), {
  ssr: false,
  loading: () => (
    <div className="grid h-[70vh] place-items-center rounded-xl border">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function EventMapPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api.get(`/events/${id}`)).data.event,
    enabled: !!id,
  });

  const media = useQuery({
    queryKey: ['event', id, 'media', 'geo'],
    queryFn: async () => (await api.get(`/events/${id}/media`, { params: { limit: 60 } })).data.data as any[],
    enabled: !!id,
  });

  const geoMedia: GeoMedia[] = (media.data ?? []).filter(
    (m) => m.gpsLatitude != null && m.gpsLongitude != null,
  );

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/events/${id}`}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to event
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">{event.data?.name ?? 'Event'} — Map</h1>
      </div>

      {media.isLoading ? (
        <div className="grid h-[70vh] place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : geoMedia.length ? (
        <PhotoMap media={geoMedia} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-20 text-center">
            <MapPin className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No location data in photos for this event</p>
            <p className="text-sm text-muted-foreground">Photos with GPS EXIF data will appear here on a map.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
