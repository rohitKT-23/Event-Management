'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Share QR modal. The backend (POST /events/:id/qr) returns a PNG data URL and
 * a deep-link share URL pointing at /qr/:id.
 */
export function QRModal({
  open,
  onClose,
  eventId,
  title = 'Share this event',
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  title?: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['event-qr', eventId],
    enabled: open && !!eventId,
    queryFn: async () => (await api.post(`/events/${eventId}/qr`)).data as { url: string; qr: string },
  });

  const shareUrl = data?.url ?? '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const downloadQr = () => {
    if (!data?.qr) return;
    const a = document.createElement('a');
    a.href = data.qr;
    a.download = `event-${eventId}-qr.png`;
    a.click();
  };

  return (
    <Modal open={open} onClose={onClose} title={title} description="Scan to open the event gallery instantly.">
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-64 w-64 place-items-center rounded-xl border bg-white">
          {isLoading || !data ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.qr} alt="Event QR code" className="h-60 w-60" />
          )}
        </div>

        {shareUrl && (
          <code className="w-full truncate rounded-md bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            {shareUrl}
          </code>
        )}

        <div className="flex w-full flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={copyLink} disabled={!shareUrl}>
            <Copy className="mr-1 h-4 w-4" /> Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={downloadQr} disabled={!data?.qr}>
            <Download className="mr-1 h-4 w-4" /> Download QR
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!shareUrl}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="mr-1 h-4 w-4" /> WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
