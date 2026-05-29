'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { api, extractApiError } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

const ROLES = ['VIEWER', 'CLUB_MEMBER', 'PHOTOGRAPHER', 'ADMIN'] as const;

type AdminUser = {
  id: string;
  username: string;
  email: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const [q, setQ] = React.useState('');
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin', 'users', q],
    queryFn: async () => (await api.get('/admin/users', { params: { q: q || undefined, limit: 100 } })).data,
  });

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) =>
      api.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by username or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {data?.data?.map((u: AdminUser) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">@{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.replace('_', ' ').toLowerCase()}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.isVerified ? (
                        <span className="text-emerald-500">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatRelativeTime(u.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete @${u.username}? This cannot be undone.`)) remove.mutate(u.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
