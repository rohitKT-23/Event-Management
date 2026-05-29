'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Users, Image as ImageIcon, Calendar, Download as DownloadIcon, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';

type Overview = { users: number; media: number; events: number; clubs: number; downloads: number };

export default function AdminOverviewPage() {
  const { data: overview } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data as Overview,
  });

  const { data: top } = useQuery({
    queryKey: ['admin', 'top-media'],
    queryFn: async () => (await api.get('/analytics/media/top')).data,
  });

  const cards = [
    { label: 'Users', value: overview?.users ?? 0, icon: Users },
    { label: 'Media', value: overview?.media ?? 0, icon: ImageIcon },
    { label: 'Events', value: overview?.events ?? 0, icon: Calendar },
    { label: 'Clubs', value: overview?.clubs ?? 0, icon: Building2 },
    { label: 'Downloads', value: overview?.downloads ?? 0, icon: DownloadIcon },
  ];

  const chartData = cards.map((c) => ({ name: c.label, value: c.value }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex flex-col gap-1 py-5">
              <c.icon className="h-5 w-5 text-muted-foreground" />
              <p className="text-2xl font-bold">{formatNumber(c.value)}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Platform totals</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Most liked media</CardTitle>
        </CardHeader>
        <CardContent>
          {top?.mostLiked?.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {top.mostLiked.slice(0, 12).map((m: any) => (
                <Link key={m.id} href={`/media/${m.id}`} className="group">
                  <div className="aspect-square overflow-hidden rounded-lg bg-secondary">
                    {m.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbnailUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatNumber(m._count?.likes ?? 0)} likes</p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No media yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
