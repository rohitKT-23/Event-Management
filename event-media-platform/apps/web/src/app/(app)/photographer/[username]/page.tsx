'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Camera, Download, Heart, ImageIcon, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';

export default function PhotographerPortfolioPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const resolved = useQuery({
    queryKey: ['user-by-username', username],
    queryFn: async () => {
      const list = (await api.get('/search', { params: { type: 'user', q: username, limit: 10 } })).data.data as any[];
      return list.find((u) => u.username?.toLowerCase() === username.toLowerCase()) ?? null;
    },
  });

  const media = useQuery({
    queryKey: ['photographer-media', username],
    enabled: !!resolved.data,
    queryFn: async () => {
      const res = (await api.get('/search', { params: { type: 'media', q: username, limit: 60 } })).data.data as any[];
      return res.filter((m) => m.uploader?.username?.toLowerCase() === username.toLowerCase());
    },
  });

  const photos = media.data ?? [];
  const bestShots = photos.slice(0, 12);
  const events = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    photos.forEach((m) => m.event && map.set(m.event.id, m.event));
    return [...map.values()];
  }, [photos]);

  const downloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const u = resolved.data;
      doc.setFontSize(26);
      doc.text(`@${u?.username}`, 40, 60);
      doc.setFontSize(12);
      doc.setTextColor(120);
      doc.text('Photographer portfolio', 40, 82);
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text(`Uploads: ${photos.length}`, 40, 120);
      doc.text(`Events covered: ${events.length}`, 40, 142);
      if (u?.bio) {
        doc.setFontSize(11);
        doc.setTextColor(80);
        doc.text(doc.splitTextToSize(u.bio, 500), 40, 170);
      }
      doc.setTextColor(0);
      doc.setFontSize(14);
      doc.text('Selected work', 40, 220);
      doc.setFontSize(10);
      doc.setTextColor(90);
      bestShots.slice(0, 9).forEach((m, i) => {
        doc.text(`• ${m.aiCaption ?? m.id}`, 50, 244 + i * 18);
      });
      doc.save(`${u?.username}-portfolio.pdf`);
    } catch {
      toast.error('Could not generate PDF');
    }
  };

  if (resolved.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!resolved.data) return <p className="text-destructive">Photographer @{username} not found.</p>;

  const u = resolved.data;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-pink-600/20 p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-2xl font-bold text-white">
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                u.username.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight">@{u.username}</h1>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Camera className="h-4 w-4" /> Photographer
              </p>
            </div>
          </div>
          <Button variant="gradient" onClick={downloadPdf}>
            <Download className="mr-1 h-4 w-4" /> Download portfolio PDF
          </Button>
        </div>

        <div className="mt-6 flex gap-8">
          <div>
            <p className="text-2xl font-bold">{formatNumber(photos.length)}</p>
            <p className="text-xs text-muted-foreground">Uploads</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatNumber(events.length)}</p>
            <p className="text-xs text-muted-foreground">Events covered</p>
          </div>
        </div>
      </div>

      {/* Best shots */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Best shots</h2>
        {bestShots.length ? (
          <div className="columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2 [&>*]:break-inside-avoid">
            {bestShots.map((m) => (
              <Link key={m.id} href={`/media/${m.id}`} className="group block overflow-hidden rounded-lg bg-secondary">
                {m.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailUrl} alt={m.aiCaption ?? ''} className="w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="grid h-40 place-items-center text-xs text-muted-foreground">processing…</div>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="grid place-items-center gap-2 py-12 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No public photos yet.</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Events covered */}
      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Events covered</h2>
        {events.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`}>
                <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex items-center gap-2 py-4">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="line-clamp-1 text-sm font-medium">{e.name}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        )}
      </section>
    </div>
  );
}
