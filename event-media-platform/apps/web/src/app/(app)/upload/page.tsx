'use client';

import * as React from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle2, AlertCircle, Loader2, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DuplicateWarningBanner } from '@/components/duplicate-warning-banner';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';

type FileEntry = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'failed' | 'skipped';
  progress: number;
  mediaId?: string;
  error?: string;
  preview: string;
  duplicate?: boolean;
  dismissedDuplicate?: boolean;
};

export default function UploadPage() {
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [eventId, setEventId] = React.useState('');
  const [albumId, setAlbumId] = React.useState('');
  const [eventQuery, setEventQuery] = React.useState('');
  const [eventOpen, setEventOpen] = React.useState(false);
  const [creatingAlbum, setCreatingAlbum] = React.useState(false);
  const [newAlbumName, setNewAlbumName] = React.useState('');
  const [summary, setSummary] = React.useState<string | null>(null);

  const events = useQuery({
    queryKey: ['upload-events', eventQuery],
    queryFn: async () => (await api.get('/events', { params: { q: eventQuery || undefined, limit: 20 } })).data.data as any[],
  });

  const albums = useQuery({
    queryKey: ['event', eventId, 'albums'],
    enabled: !!eventId,
    queryFn: async () => (await api.get(`/events/${eventId}/albums`)).data.albums as any[],
  });

  const selectedEvent = events.data?.find((e) => e.id === eventId);

  const onDrop = React.useCallback((accepted: File[]) => {
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => `${e.file.name}-${e.file.size}`));
      const additions = accepted.map((f) => {
        const dupKey = `${f.name}-${f.size}`;
        return {
          id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          status: 'queued' as const,
          progress: 0,
          preview: URL.createObjectURL(f),
          duplicate: existing.has(dupKey),
        };
      });
      return [...prev, ...additions];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    maxSize: 500 * 1024 * 1024,
  });

  const update = (id: string, patch: Partial<FileEntry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const remove = (id: string) =>
    setEntries((prev) => {
      const target = prev.find((e) => e.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((e) => e.id !== id);
    });

  const pollProcessingStatus = async (entryId: string, jobId: string) => {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const { data } = await api.get(`/media/upload-status/${jobId}`);
        if (data.uploadStatus === 'DONE') {
          update(entryId, { status: 'done' });
          return;
        }
        if (data.uploadStatus === 'FAILED') {
          update(entryId, { status: 'failed', error: 'Server processing failed' });
          return;
        }
      } catch {
        // keep polling
      }
    }
    update(entryId, { status: 'failed', error: 'Processing timed out' });
  };

  const startUpload = async (entry: FileEntry) => {
    try {
      update(entry.id, { status: 'uploading', progress: 0 });
      const dest = {
        ...(albumId && { albumId }),
        ...(eventId && { eventId }),
      };
      const { data: presigned } = await api.post('/media/presigned-url', {
        filename: entry.file.name,
        contentType: entry.file.type,
        size: entry.file.size,
        ...dest,
      });

      await axios.put(presigned.uploadUrl, entry.file, {
        headers: { 'Content-Type': entry.file.type },
        onUploadProgress: (e) => {
          if (e.total) update(entry.id, { progress: Math.round((e.loaded / e.total) * 100) });
        },
      });

      const { data: finalized } = await api.post('/media/upload', {
        s3Key: presigned.s3Key,
        filename: entry.file.name,
        contentType: entry.file.type,
        size: entry.file.size,
        ...dest,
      });

      const jobId = finalized.media.uploadJobId ?? finalized.media.id;
      update(entry.id, { status: 'processing', mediaId: finalized.media.id, progress: 100 });
      void pollProcessingStatus(entry.id, jobId);
    } catch (err) {
      const msg = extractApiError(err).message;
      update(entry.id, { status: 'failed', error: msg });
      toast.error(`${entry.file.name}: ${msg}`);
    }
  };

  const uploadAll = async () => {
    setSummary(null);
    const toUpload = entries.filter((e) => e.status === 'queued' && !(e.duplicate && !e.dismissedDuplicate));
    const skipped = entries.filter((e) => e.status === 'skipped').length;
    for (const entry of toUpload) {
      await startUpload(entry);
    }
    setSummary(`${toUpload.length} uploaded, ${skipped} skipped (duplicates)`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Upload media</h1>
        <p className="text-muted-foreground">
          Drop photos or videos. We&apos;ll compress, generate thumbnails, run AI tagging, and detect faces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Destination</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {/* Event combobox */}
          <div className="space-y-2">
            <Label>Event</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={selectedEvent && !eventOpen ? selectedEvent.name : eventQuery}
                onChange={(e) => {
                  setEventQuery(e.target.value);
                  setEventOpen(true);
                  if (eventId) {
                    setEventId('');
                    setAlbumId('');
                  }
                }}
                onFocus={() => setEventOpen(true)}
                placeholder="Search events…"
                className="pl-9"
              />
              {eventOpen && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-background shadow-lg">
                  {(events.data ?? []).map((e) => (
                    <button
                      key={e.id}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setEventId(e.id);
                        setEventOpen(false);
                        setEventQuery('');
                        setAlbumId('');
                      }}
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.club?.name} • {formatRelativeTime(e.date)}
                      </span>
                    </button>
                  ))}
                  {!events.data?.length && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No events</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Album select */}
          <div className="space-y-2">
            <Label>Album</Label>
            {creatingAlbum ? (
              <div className="flex gap-2">
                <Input value={newAlbumName} onChange={(e) => setNewAlbumName(e.target.value)} placeholder="New album name" />
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const { data } = await api.post('/albums', { eventId, name: newAlbumName.trim(), isPublic: true });
                      toast.success('Album created');
                      setAlbumId(data.album.id);
                      setCreatingAlbum(false);
                      setNewAlbumName('');
                      albums.refetch();
                    } catch (err) {
                      toast.error(extractApiError(err).message);
                    }
                  }}
                  disabled={!newAlbumName.trim()}
                >
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCreatingAlbum(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  disabled={!eventId}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{eventId ? 'No album (event only)' : 'Select an event first'}</option>
                  {(albums.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {eventId && (
                  <Button size="sm" variant="outline" onClick={() => setCreatingAlbum(true)} aria-label="New album">
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div
        {...getRootProps()}
        className={cn(
          'cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition',
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30',
        )}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <p className="font-medium">{isDragActive ? 'Drop here…' : 'Drag photos & videos, or click to browse'}</p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, HEIC, MP4, MOV up to 500MB</p>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {entries.length} file{entries.length === 1 ? '' : 's'} selected
            {summary && <span className="ml-2 font-medium text-foreground">— {summary}</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEntries([])}>
              Clear
            </Button>
            <Button variant="gradient" onClick={uploadAll}>
              Upload all
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <Card key={e.id} className="overflow-hidden">
            <div className="relative aspect-square bg-secondary">
              {e.file.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-xs text-muted-foreground">video</div>
              )}
              <button
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
                onClick={() => remove(e.id)}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
              {e.status === 'uploading' && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                  <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
                </div>
              )}
            </div>
            <CardContent className="space-y-2 p-3 text-xs">
              <p className="line-clamp-1 font-medium">{e.file.name}</p>
              <div className="flex items-center gap-1 text-muted-foreground">
                {e.status === 'queued' && <span>Queued</span>}
                {e.status === 'skipped' && <span className="text-muted-foreground">Skipped</span>}
                {e.status === 'uploading' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading {e.progress}%
                  </>
                )}
                {e.status === 'processing' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing…
                  </>
                )}
                {e.status === 'done' && (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> Done
                  </>
                )}
                {e.status === 'failed' && (
                  <>
                    <AlertCircle className="h-3 w-3 text-destructive" /> {e.error ?? 'Failed'}
                  </>
                )}
              </div>
              {e.duplicate && !e.dismissedDuplicate && e.status === 'queued' && (
                <DuplicateWarningBanner
                  newPreview={e.preview}
                  existing={{ albumName: selectedEvent?.name }}
                  onSkip={() => update(e.id, { status: 'skipped' })}
                  onUploadAnyway={() => update(e.id, { dismissedDuplicate: true })}
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
