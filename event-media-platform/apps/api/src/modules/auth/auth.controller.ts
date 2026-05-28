import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { asyncHandler } from '../../lib/http.js';
import { UnauthorizedError } from '../../lib/errors.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@emp/shared';
import {
  getCurrentUser,
  loginUser,
  logout,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
} from './auth.service.js';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string, accessMs: number, refreshMs: number) {
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

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/', domain: env.COOKIE_DOMAIN });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth', domain: env.COOKIE_DOMAIN });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setAuthCookies(res, result.accessToken, result.refreshToken, result.accessExpiresMs, result.refreshExpiresMs);
  res.status(201).json({
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: Math.floor(result.accessExpiresMs / 1000),
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setAuthCookies(res, result.accessToken, result.refreshToken, result.accessExpiresMs, result.refreshExpiresMs);
  res.json({
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: Math.floor(result.accessExpiresMs / 1000),
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw =
    (req.body?.refreshToken as string | undefined) ||
    (req as any).cookies?.[REFRESH_COOKIE];
  if (!raw) throw new UnauthorizedError('Missing refresh token');
  const result = await refreshSession(raw, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });
  setAuthCookies(res, result.accessToken, result.refreshToken, result.accessExpiresMs, result.refreshExpiresMs);
  res.json({
    user: result.user,
    accessToken: result.accessToken,
    expiresIn: Math.floor(result.accessExpiresMs / 1000),
  });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const raw =
    (req.body?.refreshToken as string | undefined) ||
    (req as any).cookies?.[REFRESH_COOKIE];
  await logout(raw);
  clearAuthCookies(res);
  res.status(204).end();
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new UnauthorizedError();
  const user = await getCurrentUser(req.user.id);
  res.json({ user });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await requestPasswordReset(email);
  // Always return 202 so we don't leak whether the email exists.
  res.status(202).json({ message: 'If the email exists, a reset link will be sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await resetPasswordWithToken(token, password);
  res.json({ message: 'Password reset successful' });
});
