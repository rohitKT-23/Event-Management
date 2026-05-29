'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DuplicateWarningBanner({
  newPreview,
  existing,
  onSkip,
  onUploadAnyway,
}: {
  newPreview: string;
  existing: { thumbnailUrl?: string | null; albumName?: string | null; eventName?: string | null };
  onSkip: () => void;
  onUploadAnyway: () => void;
}) {
  return (
    <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs">
      <p className="mb-2 flex items-center gap-1 font-medium text-yellow-700 dark:text-yellow-400">
        <AlertTriangle className="h-3.5 w-3.5" /> Possible duplicate
      </p>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={newPreview} alt="new" className="h-12 w-12 rounded object-cover" />
        <span className="text-muted-foreground">↔</span>
        {existing.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={existing.thumbnailUrl} alt="existing" className="h-12 w-12 rounded object-cover" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded bg-secondary text-[10px] text-muted-foreground">
            existing
          </div>
        )}
      </div>
      <p className="mt-2 text-muted-foreground">
        This photo looks like one already {existing.albumName ? `in “${existing.albumName}”` : 'uploaded'}. Upload anyway?
      </p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="ghost" onClick={onSkip}>
          Skip this file
        </Button>
        <Button size="sm" variant="outline" onClick={onUploadAnyway}>
          Upload anyway
        </Button>
      </div>
    </div>
  );
}
