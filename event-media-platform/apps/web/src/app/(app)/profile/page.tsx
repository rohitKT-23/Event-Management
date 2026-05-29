'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, Settings, Upload, Download, Loader2, CheckCircle2 } from 'lucide-react';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [zipping, setZipping] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['me', 'uploads', 'all'],
    queryFn: async () => (await api.get('/users/me/uploads', { params: { limit: 60 } })).data,
  });

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const downloadZip = async () => {
    const ids = selected.size > 0 ? [...selected] : (data?.data ?? []).map((m: any) => m.id);
    if (!ids.length) return;
    setZipping(true);
    try {
      const res = await fetch(`${API_URL}/media/download-zip`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaIds: ids }),
      });
      if (!res.ok) throw new Error('Failed to build archive');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `emp-media-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${ids.length} item${ids.length === 1 ? '' : 's'}`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : extractApiError(err).message);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {user?.username ?? 'My profile'}
          </h1>
          <p className="text-muted-foreground">All media you have uploaded.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data?.data?.length ? (
            <Button variant="outline" onClick={downloadZip} disabled={zipping}>
              {zipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {selected.size > 0 ? `Download ${selected.size} as ZIP` : 'Download all as ZIP'}
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/profile/edit">
              <Settings className="mr-2 h-4 w-4" />
              Edit profile
            </Link>
          </Button>
          <Button asChild variant="gradient">
            <Link href="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : data?.data?.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.data.map((m: any) => {
            const isSelected = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-lg bg-secondary ring-offset-2 ring-offset-background',
                  isSelected && 'ring-2 ring-violet-600',
                )}
              >
                <Link href={`/media/${m.id}`}>
                  {m.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : m.uploadStatus === 'DONE' ? (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">ready</div>
                  ) : (
                    <div className="grid h-full place-items-center text-xs text-muted-foreground">processing…</div>
                  )}
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-label="Select for download"
                  className={cn(
                    'absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 bg-black/40 text-white transition',
                    isSelected ? 'border-violet-400 bg-violet-600' : 'border-white/70 opacity-0 group-hover:opacity-100',
                  )}
                >
                  {isSelected && <CheckCircle2 className="h-4 w-4" />}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No uploads yet</p>
            <p className="text-sm text-muted-foreground">Upload photos or videos to see them here.</p>
            <Button asChild variant="gradient" className="mt-2">
              <Link href="/upload">Upload media</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
