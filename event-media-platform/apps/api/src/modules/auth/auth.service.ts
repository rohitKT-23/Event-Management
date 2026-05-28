import bcrypt from 'bcrypt';
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
  signRefreshToken,
  verifyRefreshToken,
} from '../../lib/tokens.js';
import { env } from '../../config/env.js';
import type { RegisterInput, LoginInput } from '@emp/shared';

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

export async function requestPasswordReset(_email: string): Promise<void> {
  // Stub: generate token, store hashed, email link.
  // Implemented end-to-end in the email module follow-up.
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
