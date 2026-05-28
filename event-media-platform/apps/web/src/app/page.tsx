import Link from 'next/link';
import { ArrowRight, Camera, Sparkles, ScanFace, ShieldCheck, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: Sparkles,
    title: 'AI-tagged galleries',
    body:
      'Every photo is auto-tagged with scene labels, captioned by GPT-4o, and indexed so the right shot is always one search away.',
  },
  {
    icon: ScanFace,
    title: 'Find yourself in photos',
    body:
      'Upload a single selfie and we surface every event photo you appear in — powered by AWS Rekognition face matching.',
  },
  {
    icon: ShieldCheck,
    title: 'Watermarked downloads',
    body:
      'Originals stay locked. Members get crisp watermarked versions with club + event + role overlays, generated on demand.',
  },
  {
    icon: Zap,
    title: 'Realtime everything',
    body:
      'Likes, comments, tags, and upload status all push through WebSockets — no refresh, no waiting, no spinning wheels.',
  },
  {
    icon: Users,
    title: 'Built for clubs',
    body:
      'Public events, private albums, collaborative galleries, RSVP tracking, and granular role-based access (admin / photographer / member / viewer).',
  },
  {
    icon: Camera,
    title: 'Photographer-first',
    body:
      'Bulk drag-and-drop upload, HEIC + RAW + MP4 support, duplicate detection, EXIF map view, and a portfolio page out of the box.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 text-white font-bold">
              E
            </div>
            <span className="font-display text-lg font-bold tracking-tight">EMP</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            <Link href="/events" className="text-sm text-muted-foreground hover:text-foreground">
              Events
            </Link>
            <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground">
              Features
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
              API
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild variant="gradient">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[600px] rounded-full bg-pink-500/20 blur-3xl" />
        </div>

        <div className="container py-24 md:py-32 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            <span className="text-muted-foreground">
              AI captions, face matching, watermarked downloads — all built in
            </span>
          </div>
          <h1 className="font-display mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Every memory, <span className="gradient-text">organised.</span>
            <br />
            Every face, <span className="gradient-text">found.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            EMP is the centralised media platform for clubs and photographers. Upload thousands of
            photos, auto-tag them with AI, share through QR codes, and let members find themselves
            with a single selfie.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="gradient" className="group">
              <Link href="/register">
                Start uploading
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/events">Browse public events</Link>
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="container py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Everything you'd build in-house, ready out of the box.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Production-grade architecture. Postgres, Redis, S3, BullMQ workers, JWT auth with
            refresh rotation — wired together, documented, tested.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="group transition hover:-translate-y-1 hover:shadow-lg">
              <CardContent className="p-6">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/10 to-pink-600/10 text-violet-600 dark:text-violet-300">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="container py-20 text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">
            Spin it up in 60 seconds.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            One docker-compose, one migration, one seed command. Then start uploading.
          </p>
          <div className="mx-auto mt-8 max-w-xl rounded-xl border bg-background p-5 text-left font-mono text-sm shadow-inner">
            <div className="text-muted-foreground"># prerequisites: docker + node 20</div>
            <div>$ docker compose up -d postgres redis minio</div>
            <div>$ npm install</div>
            <div>$ npm run prisma:migrate</div>
            <div>$ npm run prisma:seed</div>
            <div>$ npm run dev</div>
          </div>
          <Button asChild size="lg" variant="gradient" className="mt-8">
            <Link href="/register">Create your first event →</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 md:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} EMP. Built with care.</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/docs">API docs</Link>
            <Link href="/events">Public events</Link>
            <Link href="/login">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
