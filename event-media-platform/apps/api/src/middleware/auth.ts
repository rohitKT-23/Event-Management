import type { RequestHandler } from 'express';
import { UserRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';
import { ROLE_LEVEL } from '@emp/shared';

/**
 * Extract a bearer token from `Authorization: Bearer <token>` or
 * from the `access_token` cookie (fallback for SSR/HTMX-style use).
 */
function extractToken(req: Parameters<RequestHandler>[0]): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = (req as any).cookies?.access_token as string | undefined;
  return cookie ?? null;
}

/** Requires a valid access token. Populates `req.user`. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw new UnauthorizedError('Missing access token');
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
};

/** Optional auth: attaches `req.user` if token is valid, never throws. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    // ignored — treat as anonymous
  }
  next();
};

/**
 * Role gate. Accepts the minimum required role; admins always pass.
 * Pass multiple roles to allow any of them.
 */
export function requireRole(...allowed: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (req.user.role === UserRole.ADMIN) return next();
    if (allowed.includes(req.user.role)) return next();
    throw new ForbiddenError();
  };
}

/** Require role *level* >= given role (uses ROLE_LEVEL hierarchy). */
export function requireMinRole(min: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw new UnauthorizedError();
    if (ROLE_LEVEL[req.user.role] >= ROLE_LEVEL[min]) return next();
    throw new ForbiddenError();
  };
}
