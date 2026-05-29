import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateAlbumInput } from '@emp/shared';

async function assertAlbumManager(albumId: string, userId: string, userRole: UserRole) {
  if (userRole === UserRole.ADMIN) return;
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    include: { collaborators: { where: { userId } } },
  });
  if (!album) throw new NotFoundError('Album');
  if (album.createdById === userId) return;
  if (album.collaborators.length > 0) return;
  throw new ForbiddenError('You cannot manage this album');
}

export async function createAlbum(input: CreateAlbumInput, userId: string) {
  return prisma.album.create({
    data: {
      eventId: input.eventId,
      name: input.name,
      description: input.description,
      isPublic: input.isPublic,
      createdById: userId,
    },
  });
}

export async function getAlbum(id: string) {
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      event: { select: { id: true, name: true, slug: true, clubId: true } },
      createdBy: { select: { id: true, username: true, avatarUrl: true } },
      collaborators: { include: { user: { select: { id: true, username: true, avatarUrl: true } } } },
      _count: { select: { media: true } },
    },
  });
  if (!album) throw new NotFoundError('Album');
  return album;
}

export async function updateAlbum(id: string, input: any, userId: string, userRole: UserRole) {
  await assertAlbumManager(id, userId, userRole);
  return prisma.album.update({ where: { id }, data: input });
}

export async function deleteAlbum(id: string, userId: string, userRole: UserRole) {
  await assertAlbumManager(id, userId, userRole);
  await prisma.album.delete({ where: { id } });
}

export async function listAlbumMedia(albumId: string, page: number, limit: number, viewerId?: string) {
  const where: any = { albumId, moderationStatus: 'APPROVED' };
  if (!viewerId) where.isPublic = true;
  const [data, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { uploader: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.media.count({ where }),
  ]);
  return { data, total };
}

export async function addAlbumCollaborator(
  albumId: string,
  collaboratorUserId: string,
  actorId: string,
  actorRole: UserRole,
) {
  await assertAlbumManager(albumId, actorId, actorRole);
  return prisma.albumCollaborator.upsert({
    where: { albumId_userId: { albumId, userId: collaboratorUserId } },
    create: { albumId, userId: collaboratorUserId },
    update: {},
  });
}

export async function removeAlbumCollaborator(
  albumId: string,
  collaboratorUserId: string,
  actorId: string,
  actorRole: UserRole,
) {
  await assertAlbumManager(albumId, actorId, actorRole);
  await prisma.albumCollaborator.delete({
    where: { albumId_userId: { albumId, userId: collaboratorUserId } },
  });
}
