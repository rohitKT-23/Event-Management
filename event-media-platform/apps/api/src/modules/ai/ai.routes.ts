import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { moderationDecisionSchema } from '@emp/shared';
import { prisma } from '../../lib/prisma.js';
import { BUCKETS, resolveManyMediaUrls } from '../../services/s3.js';
import { enqueueMediaProcessing } from '../../services/queue.js';
import { NotFoundError } from '../../lib/errors.js';

const router = Router();

router.post(
  '/retag/:mediaId',
  requireAuth,
  requireRole(UserRole.PHOTOGRAPHER, UserRole.ADMIN),
  validate(z.object({ mediaId: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: req.params.mediaId! } });
    if (!media) throw new NotFoundError('Media');
    await enqueueMediaProcessing({
      mediaId: media.id,
      bucket: BUCKETS.ORIGINAL,
      key: media.s3Key,
      uploaderId: media.uploaderId,
    });
    res.status(202).json({ message: 'Re-tagging queued' });
  }),
);

router.post(
  '/regenerate-caption/:mediaId',
  requireAuth,
  requireRole(UserRole.PHOTOGRAPHER, UserRole.ADMIN),
  validate(z.object({ mediaId: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: req.params.mediaId! } });
    if (!media) throw new NotFoundError('Media');
    await enqueueMediaProcessing({
      mediaId: media.id,
      bucket: BUCKETS.ORIGINAL,
      key: media.s3Key,
      uploaderId: media.uploaderId,
    });
    res.status(202).json({ message: 'Caption regeneration queued' });
  }),
);

router.get(
  '/moderation-queue',
  requireAuth,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const items = await prisma.media.findMany({
      where: { moderationStatus: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { uploader: { select: { id: true, username: true, avatarUrl: true } } },
    });
    res.json({ items: await resolveManyMediaUrls(items) });
  }),
);

router.patch(
  '/moderation/:mediaId',
  requireAuth,
  requireRole(UserRole.ADMIN),
  validate(z.object({ mediaId: z.string().min(20) }), 'params'),
  validate(moderationDecisionSchema),
  asyncHandler(async (req, res) => {
    const media = await prisma.media.update({
      where: { id: req.params.mediaId! },
      data: { moderationStatus: req.body.status, moderationReason: req.body.reason },
    });
    res.json({ media });
  }),
);

export default router;
