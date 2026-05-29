'use client';

import * as React from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { EVENT_CATEGORIES, prettyCategory, slugify } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL;

export type EventFormValues = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  date: string;
  location: string;
  isPublic: boolean;
  clubId: string;
  coverImageUrl: string | null;
};

type Club = { id: string; name: string };

export function EventForm({
  mode,
  initial,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<EventFormValues>;
}) {
  const router = useRouter();

  const [name, setName] = React.useState(initial?.name ?? '');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [slug, setSlug] = React.useState(initial?.slug ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [category, setCategory] = React.useState(initial?.category ?? 'PHOTOSHOOT');
  const [date, setDate] = React.useState(initial?.date ?? '');
  const [location, setLocation] = React.useState(initial?.location ?? '');
  const [isPublic, setIsPublic] = React.useState(initial?.isPublic ?? true);
  const [clubId, setClubId] = React.useState(initial?.clubId ?? '');
  const [coverUrl, setCoverUrl] = React.useState<string | null>(initial?.coverImageUrl ?? null);
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreview, setCoverPreview] = React.useState<string | null>(initial?.coverImageUrl ?? null);
  const [submitting, setSubmitting] = React.useState(false);

  const clubs = useQuery({
    queryKey: ['clubs', 'all-for-picker'],
    queryFn: async () => (await api.get('/clubs', { params: { limit: 50 } })).data.data as Club[],
    enabled: mode === 'create',
  });

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const onDrop = React.useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  });

  async function uploadCover(): Promise<string | null> {
    if (!coverFile) return coverUrl;
    const { data: presigned } = await api.post('/media/presigned-url', {
      filename: coverFile.name,
      contentType: coverFile.type,
      size: coverFile.size,
    });
    await axios.put(presigned.uploadUrl, coverFile, {
      headers: { 'Content-Type': coverFile.type },
    });
    if (CDN_URL) return `${CDN_URL.replace(/\/$/, '')}/${presigned.s3Key}`;
    // Without a public CDN we cannot serve the private object directly;
    // keep any previously set URL so the form still submits cleanly.
    toast.message('Cover uploaded. Set NEXT_PUBLIC_CDN_URL to display private bucket images.');
    return coverUrl;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Event name is required');
    if (!date) return toast.error('Pick an event date');
    if (mode === 'create' && !clubId) return toast.error('Choose a club for this event');

    setSubmitting(true);
    try {
      const finalCover = await uploadCover();
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        date: new Date(date).toISOString(),
        location: location.trim() || undefined,
        isPublic,
        coverImageUrl: finalCover || undefined,
      };

      if (mode === 'create') {
        const { data } = await api.post('/events', { ...payload, clubId });
        toast.success('Event created');
        router.push(`/events/${data.event.id}`);
      } else {
        const { data } = await api.patch(`/events/${initial!.id}`, payload);
        toast.success('Event updated');
        router.push(`/events/${data.event.id}`);
      }
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="grid gap-5 py-6 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Event name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring Photowalk 2026" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="spring-photowalk-2026"
            />
            <p className="text-xs text-muted-foreground">Auto-generated from the name; edit if you like.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {prettyCategory(c)}
                </option>
              ))}
            </select>
          </div>

          {mode === 'create' && (
            <div className="space-y-2">
              <Label htmlFor="club">Club</Label>
              <select
                id="club"
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a club…</option>
                {(clubs.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">You must be a member of the club.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Campus lawns" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this event about?"
              rows={4}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Public event (visible to everyone)</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <Label>Cover image</Label>
          <div
            {...getRootProps()}
            className={cn(
              'relative grid min-h-[160px] cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed text-center transition',
              isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/30',
            )}
          >
            <input {...getInputProps()} />
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="cover preview" className="h-40 w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <ImagePlus className="h-6 w-6" />
                <p className="text-sm">Drag an image here, or click to browse</p>
              </div>
            )}
          </div>
          {coverPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setCoverFile(null);
                setCoverPreview(null);
                setCoverUrl(null);
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Remove cover
            </Button>
          )}
          <div className="space-y-2">
            <Label htmlFor="coverUrl" className="text-xs text-muted-foreground">
              …or paste an image URL
            </Label>
            <Input
              id="coverUrl"
              value={coverFile ? '' : coverUrl ?? ''}
              disabled={!!coverFile}
              onChange={(e) => {
                setCoverUrl(e.target.value || null);
                setCoverPreview(e.target.value || null);
              }}
              placeholder="https://…"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" variant="gradient" disabled={submitting}>
          {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {mode === 'create' ? 'Create event' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
