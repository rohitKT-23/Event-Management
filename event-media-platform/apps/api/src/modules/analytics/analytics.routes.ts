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
  '/timeseries',
  requireAuth,
  requireRole(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [uploadsPerDay, downloadsPerDay, activeUsersPerDay, typeBreakdown, topEvents, storage] =
      await Promise.all([
        prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
          FROM "Media" WHERE "createdAt" >= ${cutoff}
          GROUP BY 1 ORDER BY 1`,
        prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT date_trunc('day', "downloadedAt") AS day, COUNT(*) AS count
          FROM "Download" WHERE "downloadedAt" >= ${cutoff}
          GROUP BY 1 ORDER BY 1`,
        prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
          SELECT day, COUNT(DISTINCT "userId") AS count FROM (
            SELECT date_trunc('day', "createdAt") AS day, "userId" FROM "Like" WHERE "createdAt" >= ${cutoff}
            UNION ALL
            SELECT date_trunc('day', "createdAt") AS day, "userId" FROM "Comment" WHERE "createdAt" >= ${cutoff}
            UNION ALL
            SELECT date_trunc('day', "createdAt") AS day, "uploaderId" AS "userId" FROM "Media" WHERE "createdAt" >= ${cutoff}
          ) t GROUP BY day ORDER BY day`,
        prisma.media.groupBy({ by: ['type'], _count: { _all: true } }),
        prisma.event.findMany({
          orderBy: { media: { _count: 'desc' } },
          take: 10,
          select: { id: true, name: true, _count: { select: { media: true } } },
        }),
        prisma.media.aggregate({ _sum: { fileSize: true } }),
      ]);

    const toSeries = (rows: Array<{ day: Date; count: bigint }>) =>
      rows.map((r) => ({ day: r.day, count: Number(r.count) }));

    res.json({
      days,
      uploadsPerDay: toSeries(uploadsPerDay),
      downloadsPerDay: toSeries(downloadsPerDay),
      activeUsersPerDay: toSeries(activeUsersPerDay),
      typeBreakdown: typeBreakdown.map((t) => ({ type: t.type, count: t._count._all })),
      topEvents: topEvents.map((e) => ({ id: e.id, name: e.name, count: e._count.media })),
      storageUsedMb: Number(storage._sum.fileSize ?? 0n) / (1024 * 1024),
    });
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
