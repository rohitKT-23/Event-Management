'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Heart,
  MessageCircle,
  Star,
  Share2,
  Download,
  MapPin,
  Camera,
  Loader2,
  ArrowLeft,
  Pencil,
  Sparkles,
  Check,
} from 'lucide-react';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber, formatRelativeTime } from '@/lib/utils';
import { isPhotographer } from '@/lib/permissions';

type MediaDetail = {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  cdnUrl: string | null;
  thumbnailUrl: string | null;
  aiCaption: string | null;
  aiTags: string[];
  width: number | null;
  height: number | null;
  isPublic: boolean;
  exif: Record<string, unknown> | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  createdAt: string;
  uploader: { id: string; username: string; avatarUrl: string | null };
  event: { id: string; name: string } | null;
  album: { id: string; name: string } | null;
  _count: { likes: number; comments: number };
};

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
  replies?: Comment[];
  _count?: { replies: number };
};

type MediaTag = {
  id: string;
  xPercent: number;
  yPercent: number;
  taggedUser: { id: string; username: string; avatarUrl: string | null };
};

export default function MediaDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [liked, setLiked] = React.useState(false);
  const [faved, setFaved] = React.useState(false);
  const [likeCount, setLikeCount] = React.useState(0);
  const [comment, setComment] = React.useState('');
  const [downloading, setDownloading] = React.useState(false);
  const [editingCaption, setEditingCaption] = React.useState(false);
  const [captionDraft, setCaptionDraft] = React.useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['media', id],
    queryFn: async () => (await api.get(`/media/${id}`)).data.media as MediaDetail,
  });

  React.useEffect(() => {
    if (data) {
      setLikeCount(data._count.likes);
      setCaptionDraft(data.aiCaption ?? '');
    }
  }, [data]);

  const canEdit = !!me && (data?.uploader?.id === me.id || me.role === 'ADMIN');

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

  // Determine if the current user already liked this media.
  useQuery({
    queryKey: ['media', id, 'likes', 'mine'],
    enabled: Boolean(me),
    queryFn: async () => {
      const res = (await api.get(`/media/${id}/likes`, { params: { limit: 100 } })).data;
      const mine = (res.data ?? []).some((l: any) => l.user?.id === me?.id);
      setLiked(mine);
      return mine;
    },
  });

  const { data: comments } = useQuery({
    queryKey: ['media', id, 'comments'],
    queryFn: async () => (await api.get(`/media/${id}/comments`, { params: { limit: 50 } })).data.data as Comment[],
  });

  const { data: tags } = useQuery({
    queryKey: ['media', id, 'tags'],
    queryFn: async () => (await api.get(`/media/${id}/tags`)).data.tags as MediaTag[],
  });

  const toggleLike = async () => {
    if (!me) return toast.error('Sign in to like');
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      if (next) await api.post(`/media/${id}/like`);
      else await api.delete(`/media/${id}/like`);
    } catch (err) {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
      toast.error(extractApiError(err).message);
    }
  };

  const toggleFav = async () => {
    if (!me) return toast.error('Sign in to favourite');
    const next = !faved;
    setFaved(next);
    try {
      if (next) await api.post(`/media/${id}/favourite`);
      else await api.delete(`/media/${id}/favourite`);
      toast.success(next ? 'Added to favourites' : 'Removed from favourites');
    } catch (err) {
      setFaved(!next);
      toast.error(extractApiError(err).message);
    }
  };

  const addComment = useMutation({
    mutationFn: async (content: string) => (await api.post(`/media/${id}/comment`, { content })).data,
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['media', id, 'comments'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const onShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      await api.post(`/media/${id}/share`, { platform: 'LINK' }).catch(() => undefined);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      for (let attempt = 0; attempt < 15; attempt++) {
        const { data: dl } = await api.get(`/media/${id}/download`);
        if (dl.ready && dl.url) {
          window.open(dl.url, '_blank');
          toast.success('Download ready');
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      toast.message('Watermark is still rendering — try again in a moment.');
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-muted-foreground">This media is unavailable or private.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to feed</Link>
        </Button>
      </div>
    );
  }

  const exifEntries = data.exif ? Object.entries(data.exif).filter(([, v]) => v != null) : [];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Media + tag pins */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border bg-black/90">
            {data.type === 'VIDEO' ? (
              <video src={data.cdnUrl ?? undefined} controls poster={data.thumbnailUrl ?? undefined} className="max-h-[70vh] w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.cdnUrl ?? data.thumbnailUrl ?? ''}
                alt={data.aiCaption ?? 'media'}
                className="max-h-[70vh] w-full object-contain"
              />
            )}
            {tags?.map((t) => (
              <div
                key={t.id}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${t.xPercent}%`, top: `${t.yPercent}%` }}
                title={t.taggedUser.username}
              >
                <span className="block rounded-full border-2 border-white bg-violet-600/80 px-2 py-0.5 text-xs font-medium text-white shadow">
                  @{t.taggedUser.username}
                </span>
              </div>
            ))}
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={liked ? 'gradient' : 'outline'} size="sm" onClick={toggleLike}>
              <Heart className={`mr-1 h-4 w-4 ${liked ? 'fill-current' : ''}`} />
              {formatNumber(likeCount)}
            </Button>
            <Button variant="outline" size="sm" disabled>
              <MessageCircle className="mr-1 h-4 w-4" />
              {formatNumber(data._count.comments)}
            </Button>
            <Button variant={faved ? 'gradient' : 'outline'} size="sm" onClick={toggleFav}>
              <Star className={`mr-1 h-4 w-4 ${faved ? 'fill-current' : ''}`} />
              Favourite
            </Button>
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="mr-1 h-4 w-4" /> Share
            </Button>
            <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
              {downloading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Download
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
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
                      <Sparkles className="mr-1 h-4 w-4" /> Regenerate with AI
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{data.aiCaption || 'No caption.'}</p>
            )}
          </div>

          {data.aiTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.aiTags.map((tag) => (
                <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: meta + comments */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 py-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-xs font-bold text-white">
                  {data.uploader.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">@{data.uploader.username}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(data.createdAt)}</p>
                </div>
              </div>
              {data.event && (
                <p className="text-muted-foreground">
                  Event:{' '}
                  <Link href={`/events/${data.event.id}`} className="text-foreground underline">
                    {data.event.name}
                  </Link>
                </p>
              )}
              {data.width && data.height && (
                <p className="text-muted-foreground">Dimensions: {data.width} × {data.height}</p>
              )}
            </CardContent>
          </Card>

          {(exifEntries.length > 0 || data.gpsLatitude) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Camera className="h-4 w-4" /> Camera & EXIF
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 py-2 text-xs text-muted-foreground">
                {exifEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="text-foreground">{String(v)}</span>
                  </div>
                ))}
                {data.gpsLatitude != null && data.gpsLongitude != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${data.gpsLatitude}&mlon=${data.gpsLongitude}#map=15/${data.gpsLatitude}/${data.gpsLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-1 text-foreground underline"
                  >
                    <MapPin className="h-3 w-3" /> View on map
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-2">
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
                  <Button
                    size="sm"
                    onClick={() => comment.trim() && addComment.mutate(comment.trim())}
                    disabled={addComment.isPending || !comment.trim()}
                  >
                    Post
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {comments?.length ? (
                  comments.map((c) => (
                    <div key={c.id} className="text-sm">
                      <p>
                        <span className="font-medium">@{c.user.username}</span>{' '}
                        <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                      </p>
                      <p className="text-muted-foreground">{c.content}</p>
                      {c.replies?.map((r) => (
                        <div key={r.id} className="ml-4 mt-1 border-l pl-2">
                          <span className="font-medium">@{r.user.username}</span>{' '}
                          <span className="text-muted-foreground">{r.content}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Be the first to comment.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
