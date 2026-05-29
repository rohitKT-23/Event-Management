'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Moon, Sun, Upload, User, Search, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, clear } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();

  const toggleLanguage = () => i18n.changeLanguage(i18n.language?.startsWith('hi') ? 'en' : 'hi');

  const onLogout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    clear();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 text-white font-bold">
            E
          </div>
          <span className="font-display text-lg font-bold tracking-tight">EMP</span>
        </Link>

        <nav className="ml-4 hidden gap-1 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">{t('nav.feed')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/events">{t('nav.events')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/my-photos">{t('nav.myPhotos')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/favourites">{t('nav.favourites')}</Link>
          </Button>
          {user?.role === 'ADMIN' && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">{t('nav.admin')}</Link>
            </Button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Search">
            <Link href="/search"><Search className="h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Notifications">
            <Link href="/notifications"><Bell className="h-4 w-4" /></Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.language')}
            title={t('common.language')}
            onClick={toggleLanguage}
          >
            <Languages className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="hidden h-4 w-4 dark:block" />
          </Button>
          <Button asChild variant="gradient" size="sm" className="ml-2">
            <Link href="/upload">
              <Upload className="mr-1 h-4 w-4" />
              Upload
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon">
            <Link href="/profile/edit" aria-label="Profile">
              <User className="h-4 w-4" />
            </Link>
          </Button>
          {user && (
            <Button variant="ghost" size="icon" aria-label="Logout" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
