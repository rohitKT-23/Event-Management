'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

/**
 * Shows a CSS-simulated preview of the watermark that will be burned into the
 * downloaded file, then requests the real signed (watermarked) URL on confirm.
 */
export function WatermarkPreview({
  open,
  onClose,
  mediaId,
  imageUrl,
  clubName,
  eventName,
  roleBadge,
}: {
  open: boolean;
  onClose: () => void;
  mediaId: string;
  imageUrl: string | null;
  clubName?: string | null;
  eventName?: string | null;
  roleBadge?: string | null;
}) {
  const [downloading, setDownloading] = React.useState(false);

  const onDownload = async () => {
    setDownloading(true);
    try {
      for (let attempt = 0; attempt < 15; attempt++) {
        const { data: dl } = await api.get(`/media/${mediaId}/download`);
        if (dl.ready && dl.url) {
          window.open(dl.url, '_blank');
          toast.success('Download ready');
          onClose();
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.message('Watermark is still rendering — try again shortly.');
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Download with watermark" className="max-w-2xl">
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-xl border bg-black/90">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="preview" className="max-h-[60vh] w-full object-contain" />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">No preview</div>
          )}

          {/* Simulated watermark overlay */}
          {clubName && (
            <span className="absolute left-3 top-3 rounded bg-black/40 px-2 py-1 text-xs font-medium text-white">
              {clubName}
            </span>
          )}
          {eventName && (
            <span className="absolute bottom-3 left-3 rounded bg-black/40 px-2 py-1 text-xs text-white">
              {eventName}
            </span>
          )}
          {roleBadge && (
            <span className="absolute bottom-3 right-3 rounded bg-violet-600/80 px-2 py-1 text-xs font-medium text-white">
              {roleBadge}
            </span>
          )}
          {clubName && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="rotate-[-20deg] select-none text-4xl font-bold uppercase tracking-widest text-white/15">
                {clubName}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          The downloaded file is watermarked server-side with the club and event branding shown above.
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="gradient" onClick={onDownload} disabled={downloading}>
            {downloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Download with watermark
          </Button>
        </div>
      </div>
    </Modal>
  );
}
