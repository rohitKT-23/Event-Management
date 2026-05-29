'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag as TagIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MediaTag = {
  id: string;
  xPercent: number;
  yPercent: number;
  taggedUser: { id: string; username: string; avatarUrl: string | null };
};

/**
 * Photo display + people-tagging UX (T2.2). Renders the image, existing tag
 * pins, and — for uploaders/admins — a click-to-tag mode with a username
 * search popup, plus the list of tagged people with remove buttons.
 */
export function TagPicker({
  mediaId,
  imageUrl,
  alt,
  canTag,
}: {
  mediaId: string;
  imageUrl: string | null;
  alt?: string;
  canTag: boolean;
}) {
  const queryClient = useQueryClient();
  const [tagMode, setTagMode] = React.useState(false);
  const [pending, setPending] = React.useState<{ x: number; y: number } | null>(null);
  const [search, setSearch] = React.useState('');

  const { data: tags } = useQuery({
    queryKey: ['media', mediaId, 'tags'],
    queryFn: async () => (await api.get(`/media/${mediaId}/tags`)).data.tags as MediaTag[],
  });

  const userSearch = useQuery({
    queryKey: ['user-search', search],
    enabled: !!pending && search.trim().length >= 2,
    queryFn: async () =>
      (await api.get('/search', { params: { type: 'user', q: search.trim(), limit: 5 } })).data.data as any[],
  });

  const addTag = useMutation({
    mutationFn: async (taggedUserId: string) =>
      api.post(`/media/${mediaId}/tag`, {
        taggedUserId,
        xPercent: pending!.x,
        yPercent: pending!.y,
      }),
    onSuccess: () => {
      toast.success('Tagged');
      setPending(null);
      setSearch('');
      setTagMode(false);
      queryClient.invalidateQueries({ queryKey: ['media', mediaId, 'tags'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const removeTag = useMutation({
    mutationFn: async (tagId: string) => api.delete(`/media/${mediaId}/tag/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media', mediaId, 'tags'] }),
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const onImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tagMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPending({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  return (
    <div className="space-y-3">
      <div
        className={cn('relative overflow-hidden rounded-xl border bg-black/90', tagMode && 'cursor-crosshair')}
        onClick={onImageClick}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={alt ?? 'media'} className="max-h-[78vh] w-full object-contain" />
        ) : (
          <div className="grid h-64 place-items-center text-sm text-muted-foreground">No preview</div>
        )}

        {tags?.map((t) => (
          <div
            key={t.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${t.xPercent}%`, top: `${t.yPercent}%` }}
            title={`@${t.taggedUser.username}`}
          >
            <span className="block rounded-full border-2 border-white bg-violet-600/80 px-2 py-0.5 text-xs font-medium text-white shadow">
              @{t.taggedUser.username}
            </span>
          </div>
        ))}

        {pending && (
          <div
            className="absolute z-10 w-56 -translate-x-1/2 rounded-lg border bg-background p-2 shadow-xl"
            style={{ left: `${pending.x}%`, top: `${pending.y}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username…"
              className="mb-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
            />
            <div className="max-h-40 overflow-y-auto">
              {(userSearch.data ?? []).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                  onClick={() => addTag.mutate(u.id)}
                >
                  @{u.username}
                </button>
              ))}
              {search.trim().length >= 2 && !userSearch.data?.length && !userSearch.isLoading && (
                <p className="px-2 py-1 text-xs text-muted-foreground">No users</p>
              )}
            </div>
            <button
              type="button"
              className="mt-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setPending(null);
                setSearch('');
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {canTag && (
        <Button
          variant={tagMode ? 'gradient' : 'outline'}
          size="sm"
          onClick={() => {
            setTagMode((v) => !v);
            setPending(null);
          }}
        >
          <TagIcon className="mr-1 h-4 w-4" /> {tagMode ? 'Click image to place tag' : 'Tag someone'}
        </Button>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tagged:</span>
          {tags.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
              @{t.taggedUser.username}
              {canTag && (
                <button onClick={() => removeTag.mutate(t.id)} aria-label="Remove tag">
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
