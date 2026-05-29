import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Routes that require a valid session (access_token cookie). */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/upload',
  '/profile',
  '/my-photos',
  '/notifications',
  '/favourites',
  '/media',
];

/** Auth pages — redirect to dashboard when already signed in. */
const AUTH_PAGES = ['/login', '/register'];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;

  if (isProtected(pathname) && !accessToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && accessToken) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
