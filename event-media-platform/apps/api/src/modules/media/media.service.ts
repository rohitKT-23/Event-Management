import { MediaType, UploadStatus, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import {
  BUCKETS,
  buildMediaKey,
  getObjectBuffer,
  presignedGetUrl,
  presignedPutUrl,
  resolveMediaUrls,
  resolveManyMediaUrls,
} from '../../services/s3.js';
import { logger } from '../../lib/logger.js';
import { enqueueMediaProcessing, enqueueWatermark } from '../../services/queue.js';
import { env } from '../../config/env.js';

const PHOTO_MIME = /^image\//;
const VIDEO_MIME = /^video\//;

function detectMediaType(mime: string): MediaType | null {
  if (PHOTO_MIME.test(mime)) return MediaType.PHOTO;
  if (VIDEO_MIME.test(mime)) return MediaType.VIDEO;
  return null;
}

export async function generatePresignedUpload(input: {
  filename: string;
  contentType: string;
  size: number;
  uploaderId: string;
  albumId?: string;
  eventId?: string;
}) {
  const type = detectMediaType(input.contentType);
  if (!type) throw new ForbiddenError('Unsupported content type');

  const dailyKey = `upload-quota:${input.uploaderId}:${new Date().toISOString().slice(0, 10)}`;
  const limitBytes = env.UPLOAD_DAILY_LIMIT_MB * 1024 * 1024;
  const { redis } = await import('../../lib/redis.js');
  const used = Number(await redis.get(dailyKey)) || 0;
  if (used + input.size > limitBytes) {
    throw new ForbiddenError(
      `Daily upload limit reached (${env.UPLOAD_DAILY_LIMIT_MB} MB). Try again tomorrow.`,
    );
  }

  const key = buildMediaKey(input.uploaderId, input.filename);
  const uploadUrl = await presignedPutUrl(BUCKETS.ORIGINAL, key, input.contentType, 600);

  // Reserve quota optimistically; finalize/cron reconciles.
  await redis.incrby(dailyKey, input.size);
  await redis.expire(dailyKey, 86_400);

  return { uploadUrl, s3Key: key, bucket: BUCKETS.ORIGINAL, expiresIn: 600 };
}

export async function finalizeUpload(input: {
  s3Key: string;
  filename: string;
  contentType: string;
  size: number;
  uploaderId: string;
  albumId?: string;
  eventId?: string;
}) {
  const type = detectMediaType(input.contentType);
  if (!type) throw new ForbiddenError('Unsupported content type');

  const media = await prisma.media.create({
    data: {
      uploaderId: input.uploaderId,
      albumId: input.albumId ?? null,
      eventId: input.eventId ?? null,
      s3Key: input.s3Key,
      mimeType: input.contentType,
      fileSize: BigInt(input.size),
      type,
      uploadStatus: UploadStatus.PENDING,
    },
  });

  const job = await enqueueMediaProcessing(
    {
      mediaId: media.id,
      bucket: BUCKETS.ORIGINAL,
      key: input.s3Key,
      uploaderId: input.uploaderId,
    },
    media.id,
  );

  await prisma.media.update({
    where: { id: media.id },
    data: { uploadJobId: job.id, uploadStatus: UploadStatus.PROCESSING },
  });

  return { ...media, uploadJobId: job.id };
}

export async function getMedia(id: string, viewerId?: string) {
  const media = await prisma.media.findUnique({
    where: { id },
    include: {
      uploader: { select: { id: true, username: true, avatarUrl: true } },
      album: { select: { id: true, name: true, isPublic: true } },
      event: { select: { id: true, name: true, isPublic: true, clubId: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!media) throw new NotFoundError('Media');
  if (!media.isPublic && (!viewerId || viewerId !== media.uploaderId)) {
    throw new ForbiddenError('Media is private');
  }
  return resolveMediaUrls(media);
}

export async function updateMedia(
  id: string,
  input: { aiCaption?: string; aiTags?: string[]; isPublic?: boolean },
  userId: string,
  userRole: UserRole,
) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new NotFoundError('Media');
  if (userRole !== UserRole.ADMIN && media.uploaderId !== userId) {
    throw new ForbiddenError('You cannot edit this media');
  }
  return prisma.media.update({ where: { id }, data: input });
}

export async function deleteMedia(id: string, userId: string, userRole: UserRole) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new NotFoundError('Media');
  if (userRole !== UserRole.ADMIN && media.uploaderId !== userId) {
    throw new ForbiddenError('You cannot delete this media');
  }
  await prisma.media.delete({ where: { id } });
}

export async function getUploadStatus(jobId: string) {
  const media = await prisma.media.findFirst({ where: { uploadJobId: jobId } });
  if (!media) throw new NotFoundError('Job');
  const resolved = await resolveMediaUrls(media);
  return {
    jobId,
    mediaId: resolved.id,
    uploadStatus: resolved.uploadStatus,
    thumbnailUrl: resolved.thumbnailUrl,
    cdnUrl: resolved.cdnUrl,
  };
}

/**
 * Collect downloadable bytes for a set of media into ZIP-ready entries.
 * Honours visibility (public, or owned by the requester) and records the
 * downloads. Prefers the processed object, falling back to the original.
 */
export async function buildMediaZip(mediaIds: string[], userId: string) {
  const rows = await prisma.media.findMany({
    where: {
      id: { in: mediaIds },
      OR: [{ isPublic: true }, { uploaderId: userId }],
    },
    select: { id: true, s3Key: true, cdnUrl: true, mimeType: true, type: true },
  });

  const entries: Array<{ name: string; buffer: Buffer }> = [];
  const usedNames = new Set<string>();

  for (const row of rows) {
    const useProcessed = row.cdnUrl && !/^https?:\/\//.test(row.cdnUrl);
    const bucket = useProcessed ? BUCKETS.PROCESSED : BUCKETS.ORIGINAL;
    const key = useProcessed ? (row.cdnUrl as string) : row.s3Key;
    try {
      const buffer = await getObjectBuffer(bucket, key);
      const ext = useProcessed ? 'jpg' : (row.s3Key.split('.').pop() || 'bin');
      let name = `${row.id}.${ext}`;
      while (usedNames.has(name)) name = `${row.id}-${entries.length}.${ext}`;
      usedNames.add(name);
      entries.push({ name, buffer });
    } catch (err) {
      logger.warn({ err, mediaId: row.id }, 'zip: failed to fetch object (skipping)');
    }
  }

  if (entries.length) {
    await prisma.download.createMany({
      data: rows.slice(0, entries.length).map((r) => ({ userId, mediaId: r.id })),
      skipDuplicates: true,
    });
  }

  return entries;
}

export async function requestDownload(mediaId: string, userId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new NotFoundError('Media');

  // If watermarked version already exists, return signed URL directly.
  if (media.watermarkUrl) {
    const url = await presignedGetUrl(BUCKETS.WATERMARKED, media.watermarkUrl, 300);
    await prisma.download.create({ data: { userId, mediaId, watermarkedUrl: url } });
    return { url, ready: true };
  }

  // Otherwise queue a job; the worker will populate watermarkUrl + emit a socket event.
  const job = await enqueueWatermark({ mediaId, userId });
  return { url: null, ready: false, jobId: job.id };
}
