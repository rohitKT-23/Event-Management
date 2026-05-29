import Link from 'next/link';

export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-bold">You&apos;re offline</h1>
        <p className="max-w-sm text-muted-foreground">
          Photos you&apos;ve already viewed are cached and still browsable. Reconnect to load the
          latest events and uploads.
        </p>
        <Link href="/dashboard" className="text-violet-500 underline">
          Try again
        </Link>
      </div>
    </div>
  );
}
