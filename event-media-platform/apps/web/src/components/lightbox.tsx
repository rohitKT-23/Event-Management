'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  Star,
  Share2,
  Download,
  Pencil,
  Sparkles,
  Camera,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TagPicker } from '@/components/tag-picker';
import { WatermarkPreview } from '@/components/watermark-preview';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { isPhotographer } from '@/lib/permissions';

export type LightboxItem = { id: string };

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
};

export function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
  context,
}: {
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  context?: { clubName?: string | null; eventName?: string | null };
}) {
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const current = items[index];
  const id = current?.id;

  const [liked, setLiked] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(0);
  const [faved, setFaved] = React.useState(false);
  const [comment, setComment] = React.useState('');
  const [editingCaption, setEditingCaption] = React.useState(false);
  const [captionDraft, setCaptionDraft] = React.useState('');
  const [wmOpen, setWmOpen] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['media', id],
    enabled: !!id,
    queryFn: async () => (await api.get(`/media/${id}`)).data.media,
  });

  React.useEffect(() => {
    if (data) {
      setLikeCount(data._count?.likes ?? 0);
      setCaptionDraft(data.aiCaption ?? '');
      setEditingCaption(false);
    }
  }, [data]);

  useQuery({
    queryKey: ['media', id, 'likes', 'mine'],
    enabled: Boolean(me && id),
    queryFn: async () => {
      const res = (await api.get(`/media/${id}/likes`, { params: { limit: 100 } })).data;
      setLiked((res.data ?? []).some((l: any) => l.user?.id === me?.id));
      return true;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ['media', id, 'comments'],
    enabled: !!id,
    queryFn: async () => (await api.get(`/media/${id}/comments`, { params: { limit: 50 } })).data.data as Comment[],
  });

  const prev = React.useCallback(() => onIndexChange(Math.max(0, index - 1)), [index, onIndexChange]);
  const next = React.useCallback(() => onIndexChange(Math.min(items.length - 1, index + 1)), [index, items.length, onIndexChange]);

  const toggleLike = React.useCallback(async () => {
    if (!me) return toast.error('Sign in to like');
    const nv = !liked;
    setLiked(nv);
    setLikeCount((c) => c + (nv ? 1 : -1));
    try {
      if (nv) await api.post(`/media/${id}/like`);
      else await api.delete(`/media/${id}/like`);
    } catch (err) {
      setLiked(!nv);
      setLikeCount((c) => c + (nv ? -1 : 1));
      toast.error(extractApiError(err).message);
    }
  }, [id, liked, me]);

  const toggleFav = React.useCallback(async () => {
    if (!me) return toast.error('Sign in to favourite');
    const nv = !faved;
    setFaved(nv);
    try {
      if (nv) await api.post(`/media/${id}/favourite`);
      else await api.delete(`/media/${id}/favourite`);
      toast.success(nv ? 'Added to favourites' : 'Removed');
    } catch (err) {
      setFaved(!nv);
      toast.error(extractApiError(err).message);
    }
  }, [id, faved, me]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key.toLowerCase() === 'l') void toggleLike();
      else if (e.key.toLowerCase() === 'f') void toggleFav();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next, toggleLike, toggleFav]);

  const touch = React.useRef<number | null>(null);

  const addComment = useMutation({
    mutationFn: async (content: string) => api.post(`/media/${id}/comment`, { content }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['media', id, 'comments'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const saveCaption = useMutation({
    mutationFn: async () => api.patch(`/media/${id}`, { aiCaption: captionDraft }),
    onSuccess: () => {
      toast.success('Caption updated');
      setEditingCaption(false);
      queryClient.invalidateQueries({ queryKey: ['media', id] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const regenerate = useMutation({
    mutationFn: async () => api.post(`/ai/regenerate-caption/${id}`),
    onSuccess: () => toast.message('AI caption regeneration queued — refresh shortly.'),
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const onShare = async () => {
    const url = `${window.location.origin}/media/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      await api.post(`/media/${id}/share`, { platform: 'LINK' }).catch(() => undefined);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  if (!current) return null;
  const canEdit = !!me && (data?.uploader?.id === me.id || me.role === 'ADMIN');

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm md:flex-row">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-20 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Media area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-2 md:p-6"
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = (e.changedTouches[0]?.clientX ?? 0) - touch.current;
          if (dx > 60) prev();
          else if (dx < -60) next();
          touch.current = null;
        }}
      >
        {index > 0 && (
          <button
            onClick={prev}
            aria-label="Previous"
            className="absolute left-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div className="max-h-full w-full max-w-3xl">
          {isLoading || !data ? (
            <div className="grid h-80 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            </div>
          ) : data.type === 'VIDEO' ? (
            <video src={data.cdnUrl ?? undefined} controls poster={data.thumbnailUrl ?? undefined} className="max-h-[80vh] w-full rounded-xl" />
          ) : (
            <TagPicker
              mediaId={id!}
              imageUrl={data.cdnUrl ?? data.thumbnailUrl ?? null}
              alt={data.aiCaption ?? 'media'}
              canTag={canEdit}
            />
          )}
        </div>

        {index < items.length - 1 && (
          <button
            onClick={next}
            aria-label="Next"
            className="absolute right-2 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-t bg-background p-4 md:w-96 md:border-l md:border-t-0">
        {data && (
          <>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-xs font-bold text-white">
                {data.uploader?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium">@{data.uploader?.username}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(data.createdAt)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant={liked ? 'gradient' : 'outline'} size="sm" onClick={toggleLike}>
                <Heart className={`mr-1 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
                {formatNumber(likeCount)}
              </Button>
              <Button variant={faved ? 'gradient' : 'outline'} size="sm" onClick={toggleFav}>
                <Star className={`mr-1 h-4 w-4 ${faved ? 'fill-current' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setWmOpen(true)}>
                <Download className="mr-1 h-4 w-4" /> Download
              </Button>
            </div>

            {/* Caption (editable) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-muted-foreground">Caption</span>
                {canEdit && !editingCaption && (
                  <button onClick={() => setEditingCaption(true)} aria-label="Edit caption" className="text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {editingCaption ? (
                <div className="space-y-2">
                  <Textarea value={captionDraft} onChange={(e) => setCaptionDraft(e.target.value)} rows={3} />
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => saveCaption.mutate()} disabled={saveCaption.isPending}>
                      <Check className="mr-1 h-4 w-4" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingCaption(false); setCaptionDraft(data.aiCaption ?? ''); }}>
                      Cancel
                    </Button>
                    {isPhotographer(me) && (
                      <Button size="sm" variant="outline" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
                        <Sparkles className="mr-1 h-4 w-4" /> Regenerate
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{data.aiCaption || 'No caption.'}</p>
              )}
            </div>

            {/* Tags */}
            {data.aiTags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.aiTags.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* EXIF */}
            {(data.exif || data.gpsLatitude != null) && (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p className="mb-1 flex items-center gap-1 font-medium text-foreground">
                  <Camera className="h-3.5 w-3.5" /> Camera & EXIF
                </p>
                {data.exif &&
                  Object.entries(data.exif)
                    .filter(([, v]) => v != null)
                    .slice(0, 6)
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3">
                        <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span className="text-foreground">{String(v)}</span>
                      </div>
                    ))}
                {data.gpsLatitude != null && data.gpsLongitude != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${data.gpsLatitude}&mlon=${data.gpsLongitude}#map=15/${data.gpsLatitude}/${data.gpsLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-foreground underline"
                  >
                    View on map
                  </a>
                )}
              </div>
            )}

            {/* Comments */}
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">Comments</span>
              {me && (
                <div className="flex gap-2">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && comment.trim()) addComment.mutate(comment.trim());
                    }}
                    placeholder="Add a comment…"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <Button size="sm" onClick={() => comment.trim() && addComment.mutate(comment.trim())} disabled={addComment.isPending || !comment.trim()}>
                    Post
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                {comments?.length ? (
                  comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="font-medium">@{c.user.username}</span>{' '}
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                      <p className="text-muted-foreground">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Be the first to comment.</p>
                )}
              </div>
            </div>
          </>
        )}
      </aside>

      {data && (
        <WatermarkPreview
          open={wmOpen}
          onClose={() => setWmOpen(false)}
          mediaId={id!}
          imageUrl={data.cdnUrl ?? data.thumbnailUrl ?? null}
          clubName={context?.clubName}
          eventName={context?.eventName ?? data.event?.name}
          roleBadge={data.uploader?.username ? `@${data.uploader.username}` : null}
        />
      )}
    </div>
  );
}
