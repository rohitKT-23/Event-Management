import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../lib/errors.js';
import {
  expiryMs,
  hashToken,
  signAccessToken,
  signEmailVerificationToken,
  signRefreshToken,
  verifyEmailVerificationToken,
  verifyRefreshToken,
} from '../../lib/tokens.js';
import { env } from '../../config/env.js';
import { buildIdempotencyKey } from '../../services/email/index.js';
import { enqueueEmail } from '../../services/queue.js';
import type { RegisterInput, LoginInput } from '@emp/shared';
import { nanoid } from 'nanoid';
import type { GoogleProfile } from './google.oauth.js';

export type AuthResult = {
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
  accessExpiresMs: number;
  refreshExpiresMs: number;
};

async function issueTokens(
  user: { id: string; username: string; email: string; role: UserRole },
  meta: { userAgent?: string; ip?: string },
): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshExpiresMs = expiryMs(env.JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + refreshExpiresMs);

  // Insert a row first so we can sign the refresh token with its DB id (rotation tracking).
  const tokenRow = await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: 'pending', // updated below in same transaction
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ip?.slice(0, 64),
    },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
  const refreshToken = signRefreshToken({ sub: user.id, tid: tokenRow.id });

  await prisma.refreshToken.update({
    where: { id: tokenRow.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  return { accessToken, refreshToken };
}

async function queueVerificationEmail(user: { id: string; email: string; username: string }) {
  const token = signEmailVerificationToken(user.id, user.email);
  const verifyUrl = `${env.API_BASE_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;

  await enqueueEmail({
    to: user.email,
    templateId: 'verify-email',
    vars: { username: user.username, verifyUrl },
    idempotencyKey: buildIdempotencyKey('verify-email', user.id),
  });
}

export async function registerUser(
  input: RegisterInput,
  meta: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { id: true, email: true, username: true },
  });
  if (existing) {
    if (existing.email === input.email) throw new ConflictError('Email already registered');
    throw new ConflictError('Username already taken');
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      role: input.role,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
    },
  });

  const { accessToken, refreshToken } = await issueTokens(user, meta);
  await queueVerificationEmail(user);
  return {
    user,
    accessToken,
    refreshToken,
    accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
    refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export async function loginUser(
  input: LoginInput,
  meta: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  const dbUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      passwordHash: true,
      avatarUrl: true,
      isVerified: true,
    },
  });
  if (!dbUser || !dbUser.passwordHash) throw new UnauthorizedError('Invalid credentials');
  const ok = await bcrypt.compare(input.password, dbUser.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');

  const { passwordHash: _, ...user } = dbUser;
  const { accessToken, refreshToken } = await issueTokens(user, meta);
  return {
    user,
    accessToken,
    refreshToken,
    accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
    refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export async function refreshSession(
  rawRefreshToken: string,
  meta: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  if (!rawRefreshToken) throw new UnauthorizedError('Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tid } });
  if (!stored || stored.userId !== payload.sub) throw new UnauthorizedError('Token not recognised');
  if (stored.revokedAt) throw new UnauthorizedError('Refresh token has been revoked');
  if (stored.expiresAt < new Date()) throw new UnauthorizedError('Refresh token has expired');
  if (stored.tokenHash !== hashToken(rawRefreshToken)) {
    // mismatch may indicate token theft → revoke entire family
    await prisma.refreshToken.updateMany({
      where: { userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new UnauthorizedError('Refresh token mismatch — all sessions revoked');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
    },
  });
  if (!user) throw new NotFoundError('User');

  // Rotate: revoke old, issue new pair.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });
  const { accessToken, refreshToken } = await issueTokens(user, meta);

  return {
    user,
    accessToken,
    refreshToken,
    accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
    refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.tid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // ignore — already invalid
  }
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      bio: true,
      isVerified: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, username: true },
  });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${env.WEB_BASE_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;

  await enqueueEmail({
    to: user.email,
    templateId: 'password-reset',
    vars: { username: user.username, resetUrl },
    idempotencyKey: buildIdempotencyKey('password-reset', user.id, tokenHash.slice(0, 16)),
  });
}

export async function verifyUserEmail(token: string): Promise<{ username: string }> {
  let payload;
  try {
    payload = verifyEmailVerificationToken(token);
  } catch {
    throw new BadRequestError('Invalid or expired verification link');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, username: true, isVerified: true },
  });
  if (!user || user.email !== payload.email) {
    throw new BadRequestError('Invalid or expired verification link');
  }

  if (!user.isVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });
  }

  return { username: user.username };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) throw new BadRequestError('Missing token or password');
  const tokenHashValue = hashToken(token);
  const row = await prisma.passwordReset.findFirst({
    where: { tokenHash: tokenHashValue, usedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!row) throw new BadRequestError('Invalid or expired reset token');
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: row.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

function slugifyUsername(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 24);
  return slug.length >= 3 ? slug : `user${nanoid(6)}`;
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = slugifyUsername(base);
  for (let attempt = 0; attempt < 10; attempt++) {
    const exists = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${slugifyUsername(base).slice(0, 18)}_${nanoid(4)}`;
  }
  return `user_${nanoid(8)}`;
}

export async function loginOrRegisterWithGoogle(
  profile: GoogleProfile,
  meta: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  if (!profile.email) throw new BadRequestError('Google account did not return an email address');

  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
    },
  });
  if (byGoogleId) {
    const { accessToken, refreshToken } = await issueTokens(byGoogleId, meta);
    return {
      user: byGoogleId,
      accessToken,
      refreshToken,
      accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
      refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
    };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
      googleId: true,
    },
  });

  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw new ConflictError('This email is linked to a different Google account');
    }

    const user = await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: profile.googleId,
        isVerified: profile.emailVerified || byEmail.isVerified,
        avatarUrl: byEmail.avatarUrl ?? profile.picture ?? null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
      },
    });

    const { accessToken, refreshToken } = await issueTokens(user, meta);
    return {
      user,
      accessToken,
      refreshToken,
      accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
      refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
    };
  }

  const usernameBase = profile.name?.trim() || profile.email.split('@')[0] || 'user';
  const username = await uniqueUsername(usernameBase);

  const user = await prisma.user.create({
    data: {
      username,
      email: profile.email,
      googleId: profile.googleId,
      avatarUrl: profile.picture ?? null,
      isVerified: profile.emailVerified,
      passwordHash: null,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      isVerified: true,
    },
  });

  const { accessToken, refreshToken } = await issueTokens(user, meta);
  return {
    user,
    accessToken,
    refreshToken,
    accessExpiresMs: expiryMs(env.JWT_ACCESS_EXPIRES_IN),
    refreshExpiresMs: expiryMs(env.JWT_REFRESH_EXPIRES_IN),
  };
}
