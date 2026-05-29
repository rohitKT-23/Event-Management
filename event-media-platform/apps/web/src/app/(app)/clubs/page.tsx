'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/ui/modal';
import { isPhotographer } from '@/lib/permissions';

export default function ClubsPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [joined, setJoined] = React.useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => (await api.get('/clubs', { params: { limit: 50 } })).data.data as any[],
  });

  const join = useMutation({
    mutationFn: async (clubId: string) =>
      api.post(`/clubs/${clubId}/members`, { userId: user!.id, role: 'MEMBER' }),
    onSuccess: (_d, clubId) => {
      setJoined((p) => ({ ...p, [clubId]: true }));
      toast.success('Joined club');
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post('/clubs', {
          name: name.trim(),
          description: description.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
        })
      ).data.club,
    onSuccess: () => {
      toast.success('Club created');
      setCreateOpen(false);
      setName('');
      setDescription('');
      setLogoUrl('');
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Clubs</h1>
          <p className="text-muted-foreground">Join a club to share and discover event photos.</p>
        </div>
        {isPhotographer(user) && (
          <Button variant="gradient" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Create club
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <CardContent className="flex items-center gap-4 p-5">
                <Link href={`/clubs/${c.id}`} className="flex flex-1 items-center gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 text-lg font-bold text-white">
                    {c.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      c.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 font-medium">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {c._count?.memberships ?? 0} members • {c._count?.events ?? 0} events
                    </p>
                  </div>
                </Link>
                <Button
                  variant={joined[c.id] ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => join.mutate(c.id)}
                  disabled={join.isPending || joined[c.id]}
                >
                  {joined[c.id] ? 'Joined' : 'Join'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No clubs yet</p>
          </CardContent>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create club">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Photography Club" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cdesc">Description</Label>
            <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clogo">Logo URL</Label>
            <Input id="clogo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="gradient" onClick={() => name.trim() && create.mutate()} disabled={create.isPending || !name.trim()}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
