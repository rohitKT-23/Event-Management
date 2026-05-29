import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import {
  BUCKETS,
  buildSelfieKey,
  getObjectBuffer,
  presignedGetUrl,
  presignedPutUrl,
  resolveManyMediaUrls,
} from '../../services/s3.js';
import { indexSelfieAndMatch } from '../../services/faces.js';
import type { UpdateUserInput } from '@emp/shared';

const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
  bio: true,
  role: true,
  createdAt: true,
} as const;

export async function getPublicUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function getPublicUserByUsername(username: string) {
  const user = await prisma.user.findUnique({ where: { username }, select: PUBLIC_USER_SELECT });
  if (!user) throw new NotFoundError('User');
  return user;
}

export async function updateMyProfile(userId: string, input: UpdateUserInput) {
  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      role: true,
      isVerified: true,
    },
  });
}

export async function deleteMyAccount(userId: string) {
  await prisma.user.delete({ where: { id: userId } });
}

export async function listMyFavourites(userId: string, page: number, limit: number) {
  const [data, total] = await Promise.all([
    prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { media: true },
    }),
    prisma.favourite.count({ where: { userId } }),
  ]);
  return { data: data.map((f) => f.media), total };
}

export async function listMyUploads(userId: string, page: number, limit: number) {
  const [rows, total] = await Promise.all([
    prisma.media.findMany({
      where: { uploaderId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where: { uploaderId: userId } }),
  ]);
  const data = await resolveManyMediaUrls(rows);
  return { data, total };
}

export async function listMyNotifications(userId: string, page: number, limit: number) {
  const [data, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.notification.count({ where: { recipientId: userId } }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
  ]);
  return { data, total, unread };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { recipientId: userId, isRead: false },
    data: { isRead: true },
  });
}

/** Presigned PUT so the browser can upload a selfie straight to the private bucket. */
export async function getSelfieUploadUrl(userId: string, contentType: string) {
  if (!/^image\//.test(contentType)) throw new ForbiddenError('Selfie must be an image');
  const key = buildSelfieKey(userId);
  const uploadUrl = await presignedPutUrl(BUCKETS.SELFIES, key, contentType, 300);
  return { uploadUrl, s3Key: key, expiresIn: 300 };
}

/**
 * Finalize a selfie upload: index the face in the Rekognition collection and
 * link the user to every already-detected matching face. Falls back to simply
 * storing the selfie when Rekognition isn't configured.
 */
export async function finalizeSelfie(userId: string, s3Key: string) {
  if (!s3Key.startsWith(`selfies/${userId}/`)) {
    throw new ForbiddenError('Invalid selfie key');
  }

  const selfieBytes = await getObjectBuffer(BUCKETS.SELFIES, s3Key);
  const result = await indexSelfieAndMatch({ userId, selfieBytes });

  const selfie = await prisma.userSelfie.create({
    data: {
      userId,
      selfieUrl: s3Key,
      rekognitionFaceId: result.rekognitionFaceId ?? `local-${Date.now()}`,
    },
  });

  const selfieUrl = await presignedGetUrl(BUCKETS.SELFIES, s3Key, 3600);

  return {
    selfie: { id: selfie.id, selfieUrl, createdAt: selfie.createdAt },
    matchedMediaCount: result.matchedMediaCount,
    rekognitionAvailable: result.rekognitionAvailable,
  };
}

export async function listMySelfies(userId: string) {
  const selfies = await prisma.userSelfie.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(
    selfies.map(async (s) => ({
      id: s.id,
      createdAt: s.createdAt,
      selfieUrl: await presignedGetUrl(BUCKETS.SELFIES, s.selfieUrl, 3600).catch(() => null),
    })),
  );
}

export async function listMyFaceMatchedPhotos(userId: string, page: number, limit: number) {
  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where: { faces: { some: { userId } }, moderationStatus: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({
      where: { faces: { some: { userId } }, moderationStatus: 'APPROVED' },
    }),
  ]);
  return { data: await resolveManyMediaUrls(data), total };
}
