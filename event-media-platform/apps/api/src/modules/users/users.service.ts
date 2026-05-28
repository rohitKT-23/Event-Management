import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
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
  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where: { uploaderId: userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.media.count({ where: { uploaderId: userId } }),
  ]);
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
  return { data, total };
}
