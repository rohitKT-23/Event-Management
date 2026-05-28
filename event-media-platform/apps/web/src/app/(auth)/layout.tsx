import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-600 lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        <Link href="/" className="flex items-center gap-2 text-white">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/15 backdrop-blur font-bold">
            E
          </div>
          <span className="font-display text-lg font-bold tracking-tight">EMP</span>
        </Link>
        <div>
          <p className="font-display text-3xl font-bold leading-tight">
            "We finally have a place where every member can find themselves in the photos."
          </p>
          <p className="mt-3 text-sm text-white/70">— Photography Club President</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
