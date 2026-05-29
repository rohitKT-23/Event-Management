'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { ScanFace, Loader2 } from 'lucide-react';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function SelfieUpload() {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const { data: selfies } = useQuery({
    queryKey: ['me', 'selfies'],
    queryFn: async () => (await api.get('/users/me/selfies')).data.data as Array<{ id: string; selfieUrl: string | null }>,
  });

  const onPick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    try {
      setBusy(true);
      const { data: presign } = await api.post('/users/me/selfie/presigned-url', {
        contentType: file.type,
      });
      await axios.put(presign.uploadUrl, file, { headers: { 'Content-Type': file.type } });
      const { data } = await api.post('/users/me/selfie', { s3Key: presign.s3Key });

      if (data.rekognitionAvailable) {
        toast.success(
          data.matchedMediaCount > 0
            ? `Selfie saved — matched ${data.matchedMediaCount} photo${data.matchedMediaCount === 1 ? '' : 's'}!`
            : 'Selfie saved — we\'ll match you as new photos are uploaded.',
        );
      } else {
        toast.success('Selfie saved. Face matching activates once Rekognition is configured.');
      }
      queryClient.invalidateQueries({ queryKey: ['me', 'selfies'] });
      queryClient.invalidateQueries({ queryKey: ['me', 'my-photos'] });
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a clear front-facing selfie. We&apos;ll find every event photo you appear in and
        surface them under <strong>My photos</strong>.
      </p>

      {selfies && selfies.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selfies.map((s) => (
            <div key={s.id} className="h-16 w-16 overflow-hidden rounded-full border bg-secondary">
              {s.selfieUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.selfieUrl} alt="selfie" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <ScanFace className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      <Button onClick={onPick} disabled={busy} variant="gradient">
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <ScanFace className="mr-2 h-4 w-4" /> Upload selfie
          </>
        )}
      </Button>
    </div>
  );
}
