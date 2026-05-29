'use client';

import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Collaborator = { userId: string; user: { id: string; username: string; avatarUrl: string | null } };

export function CollaboratorsPanel({
  albumId,
  collaborators,
  canManage,
}: {
  albumId: string;
  collaborators: Collaborator[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const userSearch = useQuery({
    queryKey: ['user-search', search],
    enabled: adding && search.trim().length >= 2,
    queryFn: async () =>
      (await api.get('/search', { params: { type: 'user', q: search.trim(), limit: 5 } })).data.data as any[],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['album', albumId] });

  const add = useMutation({
    mutationFn: async (userId: string) => api.post(`/albums/${albumId}/collaborators`, { userId }),
    onSuccess: () => {
      toast.success('Collaborator added');
      setSearch('');
      setAdding(false);
      invalidate();
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: async (userId: string) => api.delete(`/albums/${albumId}/collaborators/${userId}`),
    onSuccess: () => {
      toast.success('Collaborator removed');
      invalidate();
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">Collaborators</CardTitle>
        {canManage && (
          <Button variant="ghost" size="icon" onClick={() => setAdding((v) => !v)} aria-label="Add collaborator">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {collaborators.length ? (
          <div className="flex flex-wrap gap-2">
            {collaborators.map((c) => (
              <span key={c.userId} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs">
                @{c.user.username}
                {canManage && (
                  <button onClick={() => remove.mutate(c.userId)} aria-label="Remove">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No collaborators yet.</p>
        )}

        {canManage && adding && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search username…"
                className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
            {search.trim().length >= 2 &&
              (userSearch.data ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-md border p-2">
                  <span className="flex-1 text-sm">@{u.username}</span>
                  <Button size="sm" variant="outline" onClick={() => add.mutate(u.id)} disabled={add.isPending}>
                    <UserPlus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
