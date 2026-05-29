import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
};

export type RefreshTokenPayload = {
  sub: string;
  tid: string; // token id stored in DB (rotation tracking)
};

export type EmailVerifyPayload = {
  sub: string;
  email: string;
  purpose: 'email-verify';
};

const accessOptions: SignOptions = {
  expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  issuer: env.APP_NAME,
};

const refreshOptions: SignOptions = {
  expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  issuer: env.APP_NAME,
};

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, accessOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, refreshOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function signEmailVerificationToken(userId: string, email: string): string {
  const payload: EmailVerifyPayload = { sub: userId, email, purpose: 'email-verify' };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '24h',
    issuer: env.APP_NAME,
  });
}

export function verifyEmailVerificationToken(token: string): EmailVerifyPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as EmailVerifyPayload;
  if (payload.purpose !== 'email-verify') {
    throw new Error('Invalid token purpose');
  }
  return payload;
}

// Hash refresh tokens before storing them in DB — never store raw.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ms-precision expiry parser used for cookie maxAge.
export function expiryMs(expiresIn: string): number {
  const m = expiresIn.match(/^(\d+)([smhdw])$/);
  if (!m) return 0;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60_000;
    case 'h': return n * 3_600_000;
    case 'd': return n * 86_400_000;
    case 'w': return n * 7 * 86_400_000;
    default: return 0;
  }
}
