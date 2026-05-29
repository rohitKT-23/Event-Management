'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { canManageContent } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { EventForm } from '@/components/events/event-form';

export default function NewEventPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  React.useEffect(() => {
    if (user && !canManageContent(user)) router.replace('/events');
  }, [user, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/events">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to events
        </Link>
      </Button>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Create event</h1>
        <p className="text-muted-foreground">Set up a new event for your club.</p>
      </div>
      <EventForm mode="create" />
    </div>
  );
}
