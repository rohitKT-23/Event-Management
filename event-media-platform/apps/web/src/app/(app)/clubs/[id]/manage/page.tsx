'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ClubManagePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [inviteQ, setInviteQ] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [logoUrl, setLogoUrl] = React.useState('');
  const [settingsLoaded, setSettingsLoaded] = React.useState(false);

  const club = useQuery({
    queryKey: ['club', id],
    queryFn: async () => (await api.get(`/clubs/${id}`)).data.club,
    enabled: !!id,
  });

  const members = useQuery({
    queryKey: ['club', id, 'members'],
    queryFn: async () => (await api.get(`/clubs/${id}/members`)).data.members as any[],
    enabled: !!id,
  });

  React.useEffect(() => {
    if (club.data && !settingsLoaded) {
      setName(club.data.name ?? '');
      setDescription(club.data.description ?? '');
      setLogoUrl(club.data.logoUrl ?? '');
      setSettingsLoaded(true);
    }
  }, [club.data, settingsLoaded]);

  const userSearch = useQuery({
    queryKey: ['user-search', inviteQ],
    enabled: inviteQ.trim().length >= 2,
    queryFn: async () =>
      (await api.get('/search', { params: { type: 'user', q: inviteQ.trim(), limit: 5 } })).data.data as any[],
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) =>
      api.post(`/clubs/${id}/members`, { userId, role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['club', id, 'members'] }),
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => api.delete(`/clubs/${id}/members/${userId}`),
    onSuccess: () => {
      toast.success('Member removed');
      queryClient.invalidateQueries({ queryKey: ['club', id, 'members'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const invite = useMutation({
    mutationFn: async (userId: string) => api.post(`/clubs/${id}/members`, { userId, role: 'MEMBER' }),
    onSuccess: () => {
      toast.success('Member added');
      setInviteQ('');
      queryClient.invalidateQueries({ queryKey: ['club', id, 'members'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const saveSettings = useMutation({
    mutationFn: async () =>
      api.patch(`/clubs/${id}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Club updated');
      queryClient.invalidateQueries({ queryKey: ['club', id] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  if (club.isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (club.isError || !club.data) return <p className="text-destructive">Club not found.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/clubs/${id}`}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to club
        </Link>
      </Button>
      <h1 className="font-display text-3xl font-bold tracking-tight">Manage {club.data.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(members.data ?? []).map((m) => (
            <div key={m.user?.id} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-xs font-bold text-white">
                {m.user?.username?.slice(0, 2).toUpperCase()}
              </div>
              <span className="flex-1 font-medium">@{m.user?.username}</span>
              <select
                value={m.role}
                onChange={(e) => setRole.mutate({ userId: m.user.id, role: e.target.value })}
                disabled={m.user?.id === user?.id}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove.mutate(m.user.id)}
                disabled={m.user?.id === user?.id}
                aria-label="Remove member"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invite member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inviteQ}
              onChange={(e) => setInviteQ(e.target.value)}
              placeholder="Search by username…"
              className="pl-9"
            />
          </div>
          {inviteQ.trim().length >= 2 && (
            <div className="space-y-1">
              {userSearch.isLoading ? (
                <p className="text-sm text-muted-foreground">Searching…</p>
              ) : userSearch.data?.length ? (
                userSearch.data.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 rounded-md border p-2">
                    <span className="flex-1 text-sm">@{u.username}</span>
                    <Button size="sm" variant="outline" onClick={() => invite.mutate(u.id)} disabled={invite.isPending}>
                      <UserPlus className="mr-1 h-4 w-4" /> Add
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Club settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cdesc">Description</Label>
            <Textarea id="cdesc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clogo">Logo URL</Label>
            <Input id="clogo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
          </div>
          <Button variant="gradient" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            {saveSettings.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
