'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { EventForm, type EventFormValues } from '@/components/events/event-form';

function toLocalInput(value: string): string {
  const d = new Date(value);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['event', id, 'edit'],
    queryFn: async () => (await api.get(`/events/${id}`)).data.event,
    enabled: !!id,
  });

  const del = useMutation({
    mutationFn: async () => api.delete(`/events/${id}`),
    onSuccess: () => {
      toast.success('Event deleted');
      router.push('/events');
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  if (isLoading) {
    return (
      <div className="grid place-items-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) return <p className="text-destructive">Event not found.</p>;

  const initial: Partial<EventFormValues> = {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description ?? '',
    category: data.category,
    date: data.date ? toLocalInput(data.date) : '',
    location: data.location ?? '',
    isPublic: data.isPublic,
    clubId: data.clubId,
    coverImageUrl: data.coverImageUrl ?? null,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/events/${id}`}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to event
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Edit event</h1>
          <p className="text-muted-foreground">Update details or delete this event.</p>
        </div>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </div>

      <EventForm mode="edit" initial={initial} />

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete this event?"
        description="This permanently removes the event and its albums. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Delete event
          </Button>
        </div>
      </Modal>
    </div>
  );
}
