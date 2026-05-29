/**
 * Face-to-user matching via AWS Rekognition (collection-based).
 *
 * Two entry points:
 *  - matchFacesToUsers: called after media processing indexes new faces;
 *    resolves each new face to a known user selfie and notifies that user.
 *  - searchSelfieMatches: called when a user uploads a selfie; finds every
 *    already-indexed media face that matches and links it back to the user.
 *
 * All calls are graceful: without AWS credentials (or Rekognition permissions)
 * the functions no-op so local dev keeps working.
 */
import { NotificationType, NotificationEntityType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';
import { createNotification } from './notifications.js';

const FACE_MATCH_THRESHOLD = 90;

function rekognitionEnabled(): boolean {
  return Boolean(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

async function getRekognition() {
  const { RekognitionClient } = await import('@aws-sdk/client-rekognition');
  return new RekognitionClient({ region: env.AWS_REGION });
}

/** Notify a user that their face was detected in a piece of media. */
async function notifyFaceMatch(userId: string, mediaId: string, uploaderId: string) {
  if (userId === uploaderId) return;
  await createNotification({
    recipientId: userId,
    actorId: uploaderId,
    type: NotificationType.FACE_MATCH,
    entityType: NotificationEntityType.MEDIA,
    entityId: mediaId,
    message: 'was detected in a photo',
  });
}

/**
 * For each newly indexed face in a media item, search the collection for a
 * matching user selfie and, if found, attribute the face to that user.
 */
export async function matchFacesToUsers(params: {
  mediaId: string;
  faceIds: string[];
  uploaderId: string;
}): Promise<void> {
  if (!rekognitionEnabled() || params.faceIds.length === 0) return;

  try {
    const { SearchFacesCommand } = await import('@aws-sdk/client-rekognition');
    const rek = await getRekognition();
    const notified = new Set<string>();

    for (const faceId of params.faceIds) {
      const res = await rek.send(
        new SearchFacesCommand({
          CollectionId: env.REKOGNITION_COLLECTION_ID,
          FaceId: faceId,
          FaceMatchThreshold: FACE_MATCH_THRESHOLD,
          MaxFaces: 5,
        }),
      );

      const matchedFaceIds = (res.FaceMatches ?? [])
        .map((m) => m.Face?.FaceId)
        .filter(Boolean) as string[];
      if (!matchedFaceIds.length) continue;

      const selfie = await prisma.userSelfie.findFirst({
        where: { rekognitionFaceId: { in: matchedFaceIds } },
        select: { userId: true },
      });
      if (!selfie) continue;

      await prisma.faceIndex.updateMany({
        where: { mediaId: params.mediaId, rekognitionFaceId: faceId },
        data: { userId: selfie.userId },
      });

      if (!notified.has(selfie.userId)) {
        notified.add(selfie.userId);
        await notifyFaceMatch(selfie.userId, params.mediaId, params.uploaderId);
      }
    }
  } catch (err) {
    logger.warn({ err, mediaId: params.mediaId }, 'face-to-user match failed (continuing)');
  }
}

export type SelfieIndexResult = {
  rekognitionFaceId: string | null;
  matchedMediaCount: number;
  rekognitionAvailable: boolean;
};

/**
 * Index a freshly uploaded selfie and link the user to every matching media
 * face already in the collection. Returns the face id + match count.
 */
export async function indexSelfieAndMatch(params: {
  userId: string;
  selfieBytes: Buffer;
}): Promise<SelfieIndexResult> {
  if (!rekognitionEnabled()) {
    return { rekognitionFaceId: null, matchedMediaCount: 0, rekognitionAvailable: false };
  }

  const { IndexFacesCommand, SearchFacesCommand } = await import('@aws-sdk/client-rekognition');
  const rek = await getRekognition();

  const indexed = await rek.send(
    new IndexFacesCommand({
      CollectionId: env.REKOGNITION_COLLECTION_ID,
      Image: { Bytes: params.selfieBytes },
      DetectionAttributes: ['DEFAULT'],
      ExternalImageId: `selfie-${params.userId}`,
      MaxFaces: 1,
      QualityFilter: 'AUTO',
    }),
  );

  const faceId = indexed.FaceRecords?.[0]?.Face?.FaceId ?? null;
  if (!faceId) {
    return { rekognitionFaceId: null, matchedMediaCount: 0, rekognitionAvailable: true };
  }

  const search = await rek.send(
    new SearchFacesCommand({
      CollectionId: env.REKOGNITION_COLLECTION_ID,
      FaceId: faceId,
      FaceMatchThreshold: FACE_MATCH_THRESHOLD,
      MaxFaces: 100,
    }),
  );

  const matchedFaceIds = (search.FaceMatches ?? [])
    .map((m) => m.Face?.FaceId)
    .filter(Boolean) as string[];

  let matchedMediaCount = 0;
  if (matchedFaceIds.length) {
    const updated = await prisma.faceIndex.updateMany({
      where: { rekognitionFaceId: { in: matchedFaceIds }, userId: null },
      data: { userId: params.userId },
    });
    matchedMediaCount = updated.count;
  }

  return { rekognitionFaceId: faceId, matchedMediaCount, rekognitionAvailable: true };
}
