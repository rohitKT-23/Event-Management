'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar, Database, Image as ImageIcon, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';

const RANGES = [
  { label: 'Last 7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];
const PIE_COLORS = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981'];

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = React.useState(30);

  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data,
  });

  const ts = useQuery({
    queryKey: ['admin', 'timeseries', days],
    queryFn: async () => (await api.get('/analytics/timeseries', { params: { days } })).data,
  });

  const uploads = (ts.data?.uploadsPerDay ?? []).map((r: any) => ({ day: fmtDay(r.day), count: r.count }));
  const downloads = (ts.data?.downloadsPerDay ?? []).map((r: any) => ({ day: fmtDay(r.day), count: r.count }));
  const active = (ts.data?.activeUsersPerDay ?? []).map((r: any) => ({ day: fmtDay(r.day), count: r.count }));
  const topEvents = (ts.data?.topEvents ?? []).map((e: any) => ({ name: e.name, count: e.count }));
  const typeBreakdown = ts.data?.typeBreakdown ?? [];

  const cards = [
    { label: 'Total media', value: overview.data?.media ?? 0, icon: ImageIcon },
    { label: 'Total users', value: overview.data?.users ?? 0, icon: Users },
    { label: 'Total events', value: overview.data?.events ?? 0, icon: Calendar },
    { label: 'Storage (MB)', value: Math.round(ts.data?.storageUsedMb ?? 0), icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setDays(r.value)}
            className={
              'rounded-full border px-3 py-1 text-xs transition ' +
              (days === r.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-accent')
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Uploads per day">
          <LineChart data={uploads}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Downloads per day">
          <LineChart data={downloads}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#ec4899" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Active users per day">
          <AreaChart data={active}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#10b981" fill="#10b98133" strokeWidth={2} />
          </AreaChart>
        </ChartCard>

        <ChartCard title="Media type breakdown">
          <PieChart>
            <Tooltip />
            <Pie data={typeBreakdown} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={90} label>
              {typeBreakdown.map((_: any, i: number) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartCard>

        <ChartCard title="Top events by media count" className="lg:col-span-2">
          <BarChart data={topEvents} layout="vertical" margin={{ left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" fontSize={11} width={120} />
            <Tooltip />
            <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactElement; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
