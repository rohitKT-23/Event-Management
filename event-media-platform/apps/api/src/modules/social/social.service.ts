import { NotificationType, NotificationEntityType, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { createNotification } from '../../services/notifications.js';
import type { SharePlatform } from '@emp/shared';

export async function likeMedia(mediaId: string, userId: string) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, uploaderId: true },
  });
  if (!media) throw new NotFoundError('Media');
  try {
    const like = await prisma.like.create({ data: { userId, mediaId } });
    await createNotification({
      recipientId: media.uploaderId,
      actorId: userId,
      type: NotificationType.LIKE,
      entityType: NotificationEntityType.MEDIA,
      entityId: mediaId,
      message: 'liked your photo',
    });
    return like;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return prisma.like.findUnique({ where: { userId_mediaId: { userId, mediaId } } });
    }
    throw err;
  }
}

export async function unlikeMedia(mediaId: string, userId: string) {
  await prisma.like
    .delete({ where: { userId_mediaId: { userId, mediaId } } })
    .catch(() => undefined);
}

export async function listLikes(mediaId: string, page: number, limit: number) {
  const [data, total] = await Promise.all([
    prisma.like.findMany({
      where: { mediaId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    }),
    prisma.like.count({ where: { mediaId } }),
  ]);
  return { data, total };
}

export async function addComment(
  mediaId: string,
  userId: string,
  input: { content: string; parentId?: string },
) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, uploaderId: true },
  });
  if (!media) throw new NotFoundError('Media');

  const comment = await prisma.comment.create({
    data: { mediaId, userId, content: input.content, parentId: input.parentId },
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  // Notify uploader (and parent comment author if reply).
  await createNotification({
    recipientId: media.uploaderId,
    actorId: userId,
    type: NotificationType.COMMENT,
    entityType: NotificationEntityType.MEDIA,
    entityId: mediaId,
    message: 'commented on your photo',
    payload: { commentId: comment.id },
  });

  if (input.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: input.parentId } });
    if (parent && parent.userId !== userId) {
      await createNotification({
        recipientId: parent.userId,
        actorId: userId,
        type: NotificationType.COMMENT,
        entityType: NotificationEntityType.COMMENT,
        entityId: parent.id,
        message: 'replied to your comment',
        payload: { commentId: comment.id, mediaId },
      });
    }
  }
  return comment;
}

export async function listComments(mediaId: string, page: number, limit: number) {
  // Top-level only; replies fetched via /comments/:id/replies if needed.
  const [data, total] = await Promise.all([
    prisma.comment.findMany({
      where: { mediaId, parentId: null, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          take: 3,
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        },
        _count: { select: { replies: true } },
      },
    }),
    prisma.comment.count({ where: { mediaId, parentId: null, isDeleted: false } }),
  ]);
  return { data, total };
}

export async function updateComment(
  commentId: string,
  content: string,
  userId: string,
  userRole: UserRole,
) {
  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c) throw new NotFoundError('Comment');
  if (userRole !== UserRole.ADMIN && c.userId !== userId) throw new ForbiddenError();
  return prisma.comment.update({ where: { id: commentId }, data: { content } });
}

export async function deleteComment(commentId: string, userId: string, userRole: UserRole) {
  const c = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!c) throw new NotFoundError('Comment');
  if (userRole !== UserRole.ADMIN && c.userId !== userId) throw new ForbiddenError();
  // Soft-delete so threads remain coherent.
  await prisma.comment.update({
    where: { id: commentId },
    data: { isDeleted: true, content: '[deleted]' },
  });
}

export async function favouriteMedia(mediaId: string, userId: string) {
  try {
    return await prisma.favourite.create({ data: { mediaId, userId } });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return prisma.favourite.findUnique({ where: { userId_mediaId: { userId, mediaId } } });
    }
    throw err;
  }
}

export async function unfavouriteMedia(mediaId: string, userId: string) {
  await prisma.favourite
    .delete({ where: { userId_mediaId: { userId, mediaId } } })
    .catch(() => undefined);
}

export async function shareMedia(mediaId: string, userId: string, platform: SharePlatform) {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { uploaderId: true },
  });
  if (!media) throw new NotFoundError('Media');

  const share = await prisma.share.create({
    data: { mediaId, userId, platform: platform as any },
  });

  await createNotification({
    recipientId: media.uploaderId,
    actorId: userId,
    type: NotificationType.SHARE,
    entityType: NotificationEntityType.MEDIA,
    entityId: mediaId,
    message: `shared your photo to ${platform.toLowerCase()}`,
  });
  return share;
}

export async function tagUserOnMedia(
  mediaId: string,
  taggedUserId: string,
  taggedById: string,
  xPercent: number,
  yPercent: number,
) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new NotFoundError('Media');
  const tag = await prisma.mediaTag.create({
    data: { mediaId, taggedUserId, taggedById, xPercent, yPercent },
  });
  await createNotification({
    recipientId: taggedUserId,
    actorId: taggedById,
    type: NotificationType.TAG,
    entityType: NotificationEntityType.MEDIA,
    entityId: mediaId,
    message: 'tagged you in a photo',
    payload: { x: xPercent, y: yPercent },
  });
  return tag;
}

export async function removeTag(tagId: string, userId: string, userRole: UserRole) {
  const tag = await prisma.mediaTag.findUnique({ where: { id: tagId } });
  if (!tag) throw new NotFoundError('Tag');
  if (
    userRole !== UserRole.ADMIN &&
    tag.taggedById !== userId &&
    tag.taggedUserId !== userId
  ) {
    throw new ForbiddenError();
  }
  await prisma.mediaTag.delete({ where: { id: tagId } });
}

export async function listMediaTags(mediaId: string) {
  return prisma.mediaTag.findMany({
    where: { mediaId },
    include: { taggedUser: { select: { id: true, username: true, avatarUrl: true } } },
  });
}
