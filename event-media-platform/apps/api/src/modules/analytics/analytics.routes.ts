import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../lib/prisma.js';
import { resolveManyMediaUrls } from '../../services/s3.js';

const router = Router();

router.get(
  '/overview',
  requireAuth,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const [users, media, events, clubs, downloads] = await Promise.all([
      prisma.user.count(),
      prisma.media.count(),
      prisma.event.count(),
      prisma.club.count(),
      prisma.download.count(),
    ]);
    res.json({ users, media, events, clubs, downloads });
  }),
);

router.get(
  '/events/:id',
  requireAuth,
  requireRole(UserRole.PHOTOGRAPHER, UserRole.ADMIN),
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const eventId = req.params.id!;
    const [viewsByDay, totalViews, totalMedia, topMedia] = await Promise.all([
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "viewedAt") AS day, COUNT(*) AS count
        FROM "EventView" WHERE "eventId" = ${eventId}
        GROUP BY 1 ORDER BY 1 DESC LIMIT 30`,
      prisma.eventView.count({ where: { eventId } }),
      prisma.media.count({ where: { eventId } }),
      prisma.media.findMany({
        where: { eventId },
        orderBy: { likes: { _count: 'desc' } },
        take: 10,
        include: { _count: { select: { likes: true, comments: true, downloads: true } } },
      }),
    ]);
    res.json({
      totalViews,
      totalMedia,
      viewsByDay: viewsByDay.map((r) => ({ day: r.day, count: Number(r.count) })),
      topMedia,
    });
  }),
);

router.get(
  '/media/top',
  requireAuth,
  requireRole(UserRole.PHOTOGRAPHER, UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    const [mostLiked, mostDownloaded] = await Promise.all([
      prisma.media.findMany({
        orderBy: { likes: { _count: 'desc' } },
        take: 20,
        include: { _count: { select: { likes: true, downloads: true } } },
      }),
      prisma.media.findMany({
        orderBy: { downloads: { _count: 'desc' } },
        take: 20,
        include: { _count: { select: { likes: true, downloads: true } } },
      }),
    ]);
    res.json({
      mostLiked: await resolveManyMediaUrls(mostLiked),
      mostDownloaded: await resolveManyMediaUrls(mostDownloaded),
    });
  }),
);

export default router;
