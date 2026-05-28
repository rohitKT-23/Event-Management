import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http.js';
import { validate } from '../../middleware/validate.js';
import { optionalAuth } from '../../middleware/auth.js';
import { searchMediaQuerySchema } from '@emp/shared';
import { prisma } from '../../lib/prisma.js';

const router = Router();

/**
 * Smart search across media, events and users.
 *
 * - media: matches `aiTags` (array contains), `aiCaption`, and album/event names.
 *   Uses ILIKE for prefix-friendly matches; for production swap in `to_tsvector` GIN.
 * - event: matches event name/description.
 * - user:  prefix-matches username.
 */
router.get(
  '/',
  optionalAuth,
  validate(searchMediaQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ReturnType<typeof searchMediaQuerySchema.parse>;
    const term = (q.q ?? '').trim();
    const limit = q.limit;
    const skip = (q.page - 1) * limit;
    const dateWhere: any = {};
    if (q.dateFrom) dateWhere.gte = q.dateFrom;
    if (q.dateTo) dateWhere.lte = q.dateTo;

    if (q.type === 'event') {
      const where: Prisma.EventWhereInput = {
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        }),
        ...(Object.keys(dateWhere).length ? { date: dateWhere } : {}),
        ...(req.user ? {} : { isPublic: true }),
      };
      const [data, total] = await Promise.all([
        prisma.event.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take: limit,
          include: { club: { select: { name: true, logoUrl: true } } },
        }),
        prisma.event.count({ where }),
      ]);
      res.json({ type: 'event', data, total, page: q.page, limit, hasMore: q.page * limit < total });
      return;
    }

    if (q.type === 'user') {
      const where: Prisma.UserWhereInput = term
        ? {
            OR: [
              { username: { contains: term, mode: 'insensitive' } },
              { bio: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {};
      const [data, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            role: true,
          },
        }),
        prisma.user.count({ where }),
      ]);
      res.json({ type: 'user', data, total, page: q.page, limit, hasMore: q.page * limit < total });
      return;
    }

    // media (default)
    const tagList = q.tags?.split(',').map((t) => t.trim()).filter(Boolean) ?? [];
    const where: Prisma.MediaWhereInput = {
      moderationStatus: 'APPROVED',
      ...(req.user ? {} : { isPublic: true }),
      ...(q.eventId ? { eventId: q.eventId } : {}),
      ...(Object.keys(dateWhere).length ? { createdAt: dateWhere } : {}),
      ...(tagList.length ? { aiTags: { hasSome: tagList } } : {}),
      ...(term && {
        OR: [
          { aiCaption: { contains: term, mode: 'insensitive' } },
          { aiTags: { has: term } },
          { event: { name: { contains: term, mode: 'insensitive' } } },
          { album: { name: { contains: term, mode: 'insensitive' } } },
          { uploader: { username: { contains: term, mode: 'insensitive' } } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          uploader: { select: { id: true, username: true, avatarUrl: true } },
          event: { select: { id: true, name: true } },
        },
      }),
      prisma.media.count({ where }),
    ]);
    res.json({ type: 'media', data, total, page: q.page, limit, hasMore: q.page * limit < total });
  }),
);

export default router;
