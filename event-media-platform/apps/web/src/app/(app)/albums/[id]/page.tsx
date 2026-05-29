'use client';

import * as React from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Grid3x3, LayoutGrid, ImageIcon, Loader2, Upload, X, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { InfiniteGallery } from '@/components/infinite-gallery';
import { Lightbox } from '@/components/lightbox';
import { CollaboratorsPanel } from '@/components/collaborators-panel';
import { canManageContent } from '@/lib/permissions';

type Media = { id: string; thumbnailUrl: string | null; aiCaption: string | null; _count?: { likes: number } };

export default function AlbumPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [layout, setLayout] = React.useState<'grid' | 'masonry'>('grid');
  const [items, setItems] = React.useState<Media[]>([]);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const album = useQuery({
    queryKey: ['album', id],
    queryFn: async () => (await api.get(`/albums/${id}`)).data.album,
    enabled: !!id,
  });

  const a = album.data;
  const isOwner = !!user && (a?.createdBy?.id === user.id || user.role === 'ADMIN');
  const isCollaborator = !!user && (a?.collaborators ?? []).some((c: any) => c.userId === user.id);
  const canUpload = isOwner || isCollaborator || canManageContent(user);

  const fetchPage = React.useCallback(
    async (page: number) => {
      const res = (await api.get(`/albums/${id}/media`, { params: { page, limit: 24 } })).data;
      return { data: res.data as Media[], nextPage: res.hasMore ? page + 1 : null };
    },
    [id],
  );

  if (album.isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (album.isError || !a) return <p className="text-destructive">Album not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {a.event && (
            <Link href={`/events/${a.event.id}`} className="text-sm text-muted-foreground hover:underline">
              {a.event.name}
            </Link>
          )}
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {a.name}
            {!a.isPublic && (
              <span className="ml-2 align-middle rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                Private
              </span>
            )}
          </h1>
          {a.description && <p className="mt-1 max-w-2xl text-muted-foreground">{a.description}</p>}
          <p className="mt-1 text-sm text-muted-foreground">{a._count?.media ?? 0} photos</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-1">
            <button
              onClick={() => setLayout('grid')}
              className={'rounded p-1.5 ' + (layout === 'grid' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout('masonry')}
              className={'rounded p-1.5 ' + (layout === 'masonry' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
              aria-label="Masonry view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          {canUpload && (
            <Button variant="gradient" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1 h-4 w-4" /> Upload
            </Button>
          )}
        </div>
      </div>

      {isOwner && (
        <CollaboratorsPanel
          albumId={id}
          collaborators={(a.collaborators ?? []) as any}
          canManage={isOwner}
        />
      )}

      <InfiniteGallery<Media>
        queryKey={['album', id, 'media']}
        fetchPage={fetchPage}
        layout={layout}
        onItems={setItems}
        emptyState={
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">No photos yet</p>
              <p className="text-sm text-muted-foreground">Be the first to upload to this album.</p>
              {canUpload && (
                <Button variant="gradient" onClick={() => setUploadOpen(true)}>
                  <Upload className="mr-1 h-4 w-4" /> Upload
                </Button>
              )}
            </CardContent>
          </Card>
        }
        renderItem={(m, i) => (
          <button
            key={m.id}
            onClick={() => setLightboxIndex(i)}
            className="group relative block w-full overflow-hidden rounded-lg bg-secondary"
          >
            <div className={layout === 'masonry' ? '' : 'aspect-square'}>
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbnailUrl}
                  alt={m.aiCaption ?? ''}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full min-h-[120px] place-items-center text-xs text-muted-foreground">
                  processing…
                </div>
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs text-white opacity-0 transition group-hover:opacity-100">
              <Heart className="h-3.5 w-3.5" /> {m._count?.likes ?? 0}
            </div>
          </button>
        )}
      />

      {lightboxIndex !== null && items.length > 0 && (
        <Lightbox
          items={items}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          context={{ eventName: a.event?.name }}
        />
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        albumId={id}
        eventId={a.event?.id}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ['album', id, 'media'] });
          queryClient.invalidateQueries({ queryKey: ['album', id] });
        }}
      />
    </div>
  );
}

function UploadModal({
  open,
  onClose,
  albumId,
  eventId,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  albumId: string;
  eventId?: string;
  onUploaded: () => void;
}) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);

  const onDrop = React.useCallback((accepted: File[]) => setFiles((p) => [...p, ...accepted]), []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxSize: 500 * 1024 * 1024,
  });

  const uploadAll = async () => {
    setBusy(true);
    let ok = 0;
    for (const file of files) {
      try {
        const { data: presigned } = await api.post('/media/presigned-url', {
          filename: file.name,
          contentType: file.type,
          size: file.size,
          albumId,
          ...(eventId && { eventId }),
        });
        await axios.put(presigned.uploadUrl, file, { headers: { 'Content-Type': file.type } });
        await api.post('/media/upload', {
          s3Key: presigned.s3Key,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          albumId,
          ...(eventId && { eventId }),
        });
        ok += 1;
      } catch (err) {
        toast.error(`${file.name}: ${extractApiError(err).message}`);
      }
    }
    setBusy(false);
    setFiles([]);
    toast.success(`${ok} file${ok === 1 ? '' : 's'} uploaded — processing on the server.`);
    onUploaded();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload to album">
      <div className="space-y-4">
        <div
          {...getRootProps()}
          className={
            'cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ' +
            (isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30')
          }
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm">Drag files here, or click to browse</p>
        </div>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-secondary">
                {f.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">video</div>
                )}
                <button
                  onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-0.5"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={uploadAll} disabled={busy || files.length === 0}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Upload {files.length || ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
