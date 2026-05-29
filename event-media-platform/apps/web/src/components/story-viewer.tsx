'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const SLIDE_MS = 5000;

/** Fullscreen story viewer with auto-advance, tap nav, and hold-to-pause. */
export function StoryViewer({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const [index, setIndex] = React.useState(0);
  const [progress, setProgress] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['story', storyId],
    queryFn: async () => (await api.get(`/stories/${storyId}`)).data.story,
  });

  const media: any[] = data?.media ?? [];
  const count = media.length;

  React.useEffect(() => {
    if (!count || paused) return;
    setProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / SLIDE_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        if (index < count - 1) setIndex((i) => i + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(interval);
  }, [index, count, paused, onClose]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(count - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count, onClose]);

  const current = media[index];

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black">
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="h-5 w-5" />
      </button>

      {/* Progress bars */}
      <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-3">
        {media.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white transition-[width] duration-75"
              style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-white/70" />
      ) : current ? (
        <div
          className="relative flex h-full w-full max-w-md items-center justify-center"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setPaused(false)}
        >
          {current.type === 'VIDEO' ? (
            <video src={current.cdnUrl} autoPlay className="max-h-full w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.cdnUrl ?? current.thumbnailUrl} alt={current.aiCaption ?? ''} className="max-h-full w-full object-contain" />
          )}

          {/* Tap zones */}
          <button
            className="absolute left-0 top-0 h-full w-1/2"
            aria-label="Previous"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <button
            className="absolute right-0 top-0 h-full w-1/2"
            aria-label="Next"
            onClick={() => (index < count - 1 ? setIndex((i) => i + 1) : onClose())}
          />

          {current.aiCaption && (
            <p className="absolute bottom-6 left-0 right-0 px-6 text-center text-sm text-white drop-shadow">{current.aiCaption}</p>
          )}
        </div>
      ) : (
        <p className="text-white">No photos in this story.</p>
      )}
    </div>
  );
}
