import type { AuthUser } from '@/stores/auth';

/** Roles that are allowed to create/manage events, albums and clubs. */
export function canManageContent(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role === 'PHOTOGRAPHER' || user.role === 'CLUB_MEMBER';
}

export function isAdmin(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function isPhotographer(user: Pick<AuthUser, 'role'> | null | undefined): boolean {
  return user?.role === 'PHOTOGRAPHER' || user?.role === 'ADMIN';
}

export const EVENT_CATEGORIES = [
  'PHOTOSHOOT',
  'WORKSHOP',
  'TRIP',
  'COMPETITION',
  'CULTURAL_FEST',
  'PARTY',
  'OTHER',
] as const;

export function prettyCategory(c: string): string {
  return c.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
