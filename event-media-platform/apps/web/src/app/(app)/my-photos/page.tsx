'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ScanFace } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MyPhotosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'my-photos'],
    queryFn: async () => (await api.get('/users/me/my-photos', { params: { limit: 60 } })).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">My photos</h1>
        <p className="text-muted-foreground">
          Photos where our face-matching pipeline detected you across all public events.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Searching across events…</p>
      ) : data?.data?.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.data.map((m: any) => (
            <Link key={m.id} href={`/media/${m.id}`}>
              <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                {m.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ScanFace className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No matches yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload a clear selfie from your profile and we'll find every photo of you across public events.
            </p>
            <Button asChild variant="gradient">
              <Link href="/profile/edit">Upload selfie</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
