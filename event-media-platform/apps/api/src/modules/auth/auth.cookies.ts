import type { Response } from 'express';
import { env } from '../../config/env.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const OAUTH_STATE_COOKIE = 'google_oauth_state';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  accessMs: number,
  refreshMs: number,
) {
  res.cookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: accessMs,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: refreshMs,
    path: '/api/v1/auth',
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth', domain: env.COOKIE_DOMAIN });
}

export function setOAuthStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    domain: env.COOKIE_DOMAIN,
    maxAge: 10 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export function clearOAuthStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/v1/auth', domain: env.COOKIE_DOMAIN });
}
