import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'EMP — Event & Media Platform', template: '%s · EMP' },
  description:
    'Discover, share, and relive event memories. AI-tagged galleries, facial recognition, and real-time collaboration for clubs and photographers.',
  applicationName: 'EMP',
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'Event & Media Platform',
    description: 'Centralised media management for clubs, photographers, and members.',
    type: 'website',
  },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b14' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${display.variable} font-sans min-h-screen bg-background`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
