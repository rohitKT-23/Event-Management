'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X, ShieldAlert } from 'lucide-react';
import { api, extractApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type ModerationItem = {
  id: string;
  thumbnailUrl: string | null;
  cdnUrl: string | null;
  moderationReason: string | null;
  uploader: { username: string };
};

export default function AdminModerationPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'moderation-queue'],
    queryFn: async () => (await api.get('/ai/moderation-queue')).data.items as ModerationItem[],
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      api.patch(`/ai/moderation/${id}`, { status }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'Approved' : 'Rejected');
      queryClient.invalidateQueries({ queryKey: ['admin', 'moderation-queue'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  if (isLoading) return <p className="text-muted-foreground">Loading moderation queue…</p>;

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Queue is clear</p>
          <p className="text-sm text-muted-foreground">No media is currently flagged for review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((m) => (
        <Card key={m.id} className="overflow-hidden">
          <Link href={`/media/${m.id}`}>
            <div className="aspect-video bg-secondary">
              {(m.cdnUrl || m.thumbnailUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.cdnUrl ?? m.thumbnailUrl ?? ''} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          </Link>
          <CardContent className="space-y-3 py-3">
            <p className="text-xs text-muted-foreground">by @{m.uploader.username}</p>
            {m.moderationReason && (
              <p className="rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                Flagged: {m.moderationReason}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="gradient"
                className="flex-1"
                onClick={() => decide.mutate({ id: m.id, status: 'APPROVED' })}
              >
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => decide.mutate({ id: m.id, status: 'REJECTED' })}
              >
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
