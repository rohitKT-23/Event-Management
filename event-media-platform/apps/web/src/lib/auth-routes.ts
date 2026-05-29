import type { UserRole } from '@emp/shared';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  PHOTOGRAPHER: 'Photographer',
  CLUB_MEMBER: 'Club member',
  VIEWER: 'Viewer',
};

export function formatUserRole(role: UserRole | string | undefined): string {
  if (!role) return 'Unknown';
  return ROLE_LABELS[role as UserRole] ?? role.replace(/_/g, ' ').toLowerCase();
}

/** Only allow internal relative redirects after login. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  if (value === '/login' || value === '/register') return '/dashboard';
  return value;
}
