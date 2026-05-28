'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';

export default function FavouritesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'favourites'],
    queryFn: async () => (await api.get('/users/me/favourites', { params: { limit: 60 } })).data,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">Favourites</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data?.data?.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.data.map((m: any) => (
            <Link key={m.id} href={`/media/${m.id}`}>
              <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                {m.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Heart className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Nothing saved yet</p>
            <p className="text-sm text-muted-foreground">Tap the heart on any photo to save it here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
