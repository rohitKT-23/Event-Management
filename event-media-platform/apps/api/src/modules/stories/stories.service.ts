import { UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { resolveManyMediaUrls } from '../../services/s3.js';

async function resolveStoryMedia(mediaIds: string[]) {
  if (!mediaIds.length) return [];
  const media = await prisma.media.findMany({
    where: { id: { in: mediaIds } },
    include: { uploader: { select: { id: true, username: true, avatarUrl: true } } },
  });
  const resolved = await resolveManyMediaUrls(media as any[]);
  // preserve the creator's chosen order
  const byId = new Map(resolved.map((m: any) => [m.id, m]));
  return mediaIds.map((id) => byId.get(id)).filter(Boolean);
}

export async function createStory(eventId: string, mediaIds: string[], creatorId: string) {
  const story = await prisma.story.create({
    data: { eventId, creatorId, mediaIds },
  });
  return story;
}

export async function listEventStories(eventId: string) {
  const stories = await prisma.story.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(
    stories.map(async (s) => ({
      id: s.id,
      eventId: s.eventId,
      creatorId: s.creatorId,
      createdAt: s.createdAt,
      mediaCount: Array.isArray(s.mediaIds) ? (s.mediaIds as string[]).length : 0,
      coverUrl:
        (await resolveStoryMedia(((s.mediaIds as string[]) ?? []).slice(0, 1)))[0]?.thumbnailUrl ?? null,
    })),
  );
}

export async function getStory(id: string) {
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) throw new NotFoundError('Story');
  const media = await resolveStoryMedia((story.mediaIds as string[]) ?? []);
  return { id: story.id, eventId: story.eventId, creatorId: story.creatorId, createdAt: story.createdAt, media };
}

export async function deleteStory(id: string, userId: string, role: UserRole) {
  const story = await prisma.story.findUnique({ where: { id } });
  if (!story) throw new NotFoundError('Story');
  if (story.creatorId !== userId && role !== UserRole.ADMIN) {
    throw new ForbiddenError('You cannot delete this story');
  }
  await prisma.story.delete({ where: { id } });
}
