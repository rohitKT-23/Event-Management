'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, extractApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { EVENT_CATEGORIES, prettyCategory } from '@/lib/permissions';

export default function AdminEventsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [visibility, setVisibility] = React.useState<'all' | 'public' | 'private'>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-events', { category, dateFrom, dateTo }],
    queryFn: async () =>
      (
        await api.get('/events', {
          params: {
            category: category || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: 60,
          },
        })
      ).data.data as any[],
  });

  const rows = (data ?? []).filter((e) =>
    visibility === 'all' ? true : visibility === 'public' ? e.isPublic : !e.isPublic,
  );

  const del = useMutation({
    mutationFn: async (ids: string[]) => Promise.all(ids.map((id) => api.delete(`/events/${id}`))),
    onSuccess: () => {
      toast.success('Deleted');
      setSelected(new Set());
      setConfirmBulk(false);
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
    onError: (err) => toast.error(extractApiError(err).message),
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Category</p>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">All</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {prettyCategory(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">From</p>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">To</p>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Visibility</p>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmBulk(true)}>
            <Trash2 className="mr-1 h-4 w-4" /> Delete selected ({selected.size})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3"></th>
                    <th className="p-3">Event</th>
                    <th className="p-3">Club</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Media</th>
                    <th className="p-3">Public</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                      </td>
                      <td className="p-3 font-medium">{e.name}</td>
                      <td className="p-3 text-muted-foreground">{e.club?.name ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">{prettyCategory(e.category)}</td>
                      <td className="p-3 text-muted-foreground">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="p-3">{e._count?.media ?? 0}</td>
                      <td className="p-3">{e.isPublic ? 'Yes' : 'No'}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button asChild variant="ghost" size="icon" aria-label="View">
                            <Link href={`/events/${e.id}`}><Eye className="h-4 w-4" /></Link>
                          </Button>
                          <Button asChild variant="ghost" size="icon" aria-label="Edit">
                            <Link href={`/events/${e.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => del.mutate([e.id])}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">
                        No events match.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={confirmBulk} onClose={() => setConfirmBulk(false)} title={`Delete ${selected.size} events?`} description="This cannot be undone.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmBulk(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => del.mutate([...selected])} disabled={del.isPending}>
            {del.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
