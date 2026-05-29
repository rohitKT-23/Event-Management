'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  MapPin,
  ImageIcon,
  Album as AlbumIcon,
  Pencil,
  QrCode,
  Plus,
  Map as MapIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { QRModal } from '@/components/qr-modal';
import { StoryViewer } from '@/components/story-viewer';
import { canManageContent } from '@/lib/permissions';
import { formatRelativeTime } from '@/lib/utils';

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canManage = canManageContent(user);

  const [qrOpen, setQrOpen] = React.useState(false);
  const [albumOpen, setAlbumOpen] = React.useState(false);
  const [albumName, setAlbumName] = React.useState('');
  const [albumDesc, setAlbumDesc] = React.useState('');
  const [albumPublic, setAlbumPublic] = React.useState(true);
  const [storyViewerId, setStoryViewerId] = React.useState<string | null>(null);
  const [storyOpen, setStoryOpen] = React.useState(false);
  const [storyPicks, setStoryPicks] = React.useState<string[]>([]);

  const event = useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api.get(`/events/${id}`)).data.event,
    enabled: !!id,
  });

  const albums = useQuery({
    queryKey: ['event', id, 'albums'],
    queryFn: async () => (await api.get(`/events/${id}/albums`)).data.albums as any[],
    enabled: !!id,
  });

  const media = useQuery({
    queryKey: ['event', id, 'media'],
    queryFn: async () => (await api.get(`/events/${id}/media`, { params: { limit: 24 } })).data,
    enabled: !!id,
  });

  const stories = useQuery({
    queryKey: ['event', id, 'stories'],
    queryFn: async () => (await api.get('/stories', { params: { eventId: id } })).data.stories as any[],
    enabled: !!id,
  });

  const createStory = useMutation({
    mutationFn: async () => api.post('/stories', { eventId: id, mediaIds: storyPicks }),
    onSuccess: () => {
      toast.success('Story created');
      setStoryOpen(false);
      setStoryPicks([]);
      queryClient.invalidateQueries({ queryKey: ['event', id, 'stories'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const createAlbum = useMutation({
    mutationFn: async () =>
      (
        await api.post('/albums', {
          eventId: id,
          name: albumName.trim(),
          description: albumDesc.trim() || undefined,
          isPublic: albumPublic,
        })
      ).data.album,
    onSuccess: () => {
      toast.success('Album created');
      setAlbumOpen(false);
      setAlbumName('');
      setAlbumDesc('');
      queryClient.invalidateQueries({ queryKey: ['event', id, 'albums'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
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

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/events/${id}/map`}>
              <MapIcon className="mr-1 h-4 w-4" /> Map
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
            <QrCode className="mr-1 h-4 w-4" /> Share QR
          </Button>
          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAlbumOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Create album
              </Button>
              <Button asChild variant="gradient" size="sm">
                <Link href={`/events/${id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" /> Edit event
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stories */}
      {(stories.data?.length || canManage) && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {canManage && (
            <button
              onClick={() => setStoryOpen(true)}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full border-2 border-dashed text-2xl text-muted-foreground">
                +
              </span>
              <span className="text-xs text-muted-foreground">Create</span>
            </button>
          )}
          {(stories.data ?? []).map((s) => (
            <button key={s.id} onClick={() => setStoryViewerId(s.id)} className="flex shrink-0 flex-col items-center gap-1">
              <span className="grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-pink-500 p-0.5">
                <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-background">
                  {s.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.coverUrl} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{s.mediaCount}</span>
                  )}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">Story</span>
            </button>
          ))}
        </div>
      )}

      {/* Albums */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Albums</h2>
        {albums.isLoading ? (
          <p className="text-muted-foreground">Loading albums…</p>
        ) : albums.data?.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albums.data.map((a) => (
              <Link key={a.id} href={`/albums/${a.id}`}>
                <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="relative aspect-video bg-gradient-to-br from-violet-500/20 to-pink-500/20">
                    {a.coverImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverImageUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="line-clamp-1 font-medium">{a.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a._count?.media ?? 0} photos • {formatRelativeTime(a.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="grid place-items-center gap-2 py-12 text-center">
              <AlbumIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No albums yet.</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setAlbumOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Create the first album
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Photos */}
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

      {storyViewerId && <StoryViewer storyId={storyViewerId} onClose={() => setStoryViewerId(null)} />}

      <Modal open={storyOpen} onClose={() => setStoryOpen(false)} title="Create story" description="Pick photos to include." className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {(media.data?.data ?? []).map((m: any) => {
              const picked = storyPicks.includes(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    setStoryPicks((p) => (picked ? p.filter((x) => x !== m.id) : [...p, m.id]))
                  }
                  className={
                    'relative aspect-square overflow-hidden rounded-lg border-2 ' +
                    (picked ? 'border-primary' : 'border-transparent')
                  }
                >
                  {m.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  {picked && (
                    <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs text-primary-foreground">
                      {storyPicks.indexOf(m.id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStoryOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={() => createStory.mutate()} disabled={createStory.isPending || !storyPicks.length}>
              {createStory.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create story ({storyPicks.length})
            </Button>
          </div>
        </div>
      </Modal>

      <QRModal open={qrOpen} onClose={() => setQrOpen(false)} eventId={id} title={ev.name} />

      <Modal open={albumOpen} onClose={() => setAlbumOpen(false)} title="Create album">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="albumName">Album name</Label>
            <Input id="albumName" value={albumName} onChange={(e) => setAlbumName(e.target.value)} placeholder="Day 1 highlights" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="albumDesc">Description</Label>
            <Textarea id="albumDesc" value={albumDesc} onChange={(e) => setAlbumDesc(e.target.value)} rows={3} />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={albumPublic} onChange={(e) => setAlbumPublic(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Public album</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAlbumOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gradient"
              onClick={() => albumName.trim() && createAlbum.mutate()}
              disabled={createAlbum.isPending || !albumName.trim()}
            >
              {createAlbum.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create album
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
