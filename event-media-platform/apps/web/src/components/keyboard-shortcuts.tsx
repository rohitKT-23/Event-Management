'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: '← / →', action: 'Previous / next photo (in gallery)' },
  { keys: 'L', action: 'Like the current photo' },
  { keys: 'F', action: 'Favourite the current photo' },
  { keys: 'Esc', action: 'Close the lightbox or dialog' },
  { keys: 'G', action: 'Go to the gallery (events)' },
  { keys: 'U', action: 'Go to upload' },
  { keys: '?', action: 'Show this shortcuts help' },
];

/** Global keyboard-shortcuts help. Press "?" anywhere to toggle. */
export function KeyboardShortcuts() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'g') {
        router.push('/events');
      } else if (e.key.toLowerCase() === 'u') {
        router.push('/upload');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [router]);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts">
      <div className="space-y-2">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{s.action}</span>
            <kbd className="rounded bg-secondary px-2 py-0.5 font-mono text-xs">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </Modal>
  );
}
