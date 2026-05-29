import type { Request, Response } from 'express';
import { nanoid } from 'nanoid';
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
  clearAuthCookies,
  clearOAuthStateCookie,
  OAUTH_STATE_COOKIE,
  setAuthCookies,
  setOAuthStateCookie,
} from './auth.cookies.js';
import {
  getCurrentUser,
  loginOrRegisterWithGoogle,
  loginUser,
  logout,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyUserEmail,
} from './auth.service.js';
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  isGoogleOAuthConfigured,
} from './google.oauth.js';

function loginRedirect(error?: string) {
  const url = new URL('/login', env.WEB_BASE_URL);
  if (error) url.searchParams.set('error', error);
  return url.toString();
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

export const googleAuthStart = asyncHandler(async (_req: Request, res: Response) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(loginRedirect('google_not_configured'));
  }

  const state = nanoid(32);
  setOAuthStateCookie(res, state);
  res.redirect(buildGoogleAuthUrl(state));
});

export const googleAuthCallback = asyncHandler(async (req: Request, res: Response) => {
  if (!isGoogleOAuthConfigured()) {
    return res.redirect(loginRedirect('google_not_configured'));
  }

  const oauthError = req.query.error as string | undefined;
  if (oauthError) {
    clearOAuthStateCookie(res);
    return res.redirect(loginRedirect('google_denied'));
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const storedState = (req as any).cookies?.[OAUTH_STATE_COOKIE] as string | undefined;

  clearOAuthStateCookie(res);

  if (!code || !state || !storedState || state !== storedState) {
    return res.redirect(loginRedirect('google_state_mismatch'));
  }

  try {
    const profile = await exchangeGoogleCode(code);
    const result = await loginOrRegisterWithGoogle(profile, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      result.accessExpiresMs,
      result.refreshExpiresMs,
    );

    const successUrl = new URL('/dashboard', env.WEB_BASE_URL);
    successUrl.searchParams.set('oauth', 'google');
    return res.redirect(successUrl.toString());
  } catch {
    return res.redirect(loginRedirect('google_auth_failed'));
  }
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw =
    (req.body?.refreshToken as string | undefined) ||
    (req as any).cookies?.refresh_token;
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
    (req as any).cookies?.refresh_token;
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
  res.status(202).json({ message: 'If the email exists, a reset link will be sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = resetPasswordSchema.parse(req.body);
  await resetPasswordWithToken(token, password);
  res.json({ message: 'Password reset successful' });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.query.token as string | undefined)?.trim();
  if (!token) {
    return res.redirect(loginRedirect('verify_missing_token'));
  }

  try {
    const { username } = await verifyUserEmail(token);
    const successUrl = new URL('/login', env.WEB_BASE_URL);
    successUrl.searchParams.set('verified', username);
    return res.redirect(successUrl.toString());
  } catch {
    return res.redirect(loginRedirect('verify_failed'));
  }
});
