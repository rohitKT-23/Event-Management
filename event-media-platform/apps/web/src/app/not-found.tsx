import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <p className="font-display text-7xl font-bold gradient-text">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">Lost in the gallery</h1>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild variant="gradient" className="mt-6">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  );
}
