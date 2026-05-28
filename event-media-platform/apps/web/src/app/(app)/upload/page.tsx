'use client';

import * as React from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FileEntry = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'failed';
  progress: number;
  mediaId?: string;
  error?: string;
  preview: string;
};

export default function UploadPage() {
  const [entries, setEntries] = React.useState<FileEntry[]>([]);
  const [albumId, setAlbumId] = React.useState('');
  const [eventId, setEventId] = React.useState('');

  const onDrop = React.useCallback((accepted: File[]) => {
    setEntries((prev) => [
      ...prev,
      ...accepted.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        status: 'queued' as const,
        progress: 0,
        preview: URL.createObjectURL(f),
      })),
    ]);
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

  const startUpload = async (entry: FileEntry) => {
    try {
      update(entry.id, { status: 'uploading', progress: 0 });
      const { data: presigned } = await api.post('/media/presigned-url', {
        filename: entry.file.name,
        contentType: entry.file.type,
        size: entry.file.size,
        ...(albumId && { albumId }),
        ...(eventId && { eventId }),
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
        ...(albumId && { albumId }),
        ...(eventId && { eventId }),
      });

      update(entry.id, { status: 'processing', mediaId: finalized.media.id, progress: 100 });
      toast.success(`${entry.file.name} uploaded — processing on the server.`);
    } catch (err) {
      const msg = extractApiError(err).message;
      update(entry.id, { status: 'failed', error: msg });
      toast.error(`${entry.file.name}: ${msg}`);
    }
  };

  const uploadAll = async () => {
    for (const entry of entries.filter((e) => e.status === 'queued')) {
      await startUpload(entry);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Upload media</h1>
        <p className="text-muted-foreground">
          Drop photos or videos. We'll compress, generate thumbnails, run AI tagging, and detect faces.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Destination</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="albumId">Album ID (optional)</Label>
            <Input id="albumId" value={albumId} onChange={(e) => setAlbumId(e.target.value)} placeholder="cl…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventId">Event ID (optional)</Label>
            <Input id="eventId" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="cl…" />
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
        <p className="font-medium">
          {isDragActive ? 'Drop here…' : 'Drag photos & videos, or click to browse'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, HEIC, MP4, MOV up to 500MB</p>
      </div>

      {entries.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {entries.length} file{entries.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => entries.forEach((e) => remove(e.id))}>
              Clear
            </Button>
            <Button variant="gradient" onClick={uploadAll}>
              Upload all
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
            <CardContent className="p-3 text-xs">
              <p className="line-clamp-1 font-medium">{e.file.name}</p>
              <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                {e.status === 'queued' && <span>Queued</span>}
                {e.status === 'uploading' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading {e.progress}%
                  </>
                )}
                {e.status === 'processing' && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing…
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
