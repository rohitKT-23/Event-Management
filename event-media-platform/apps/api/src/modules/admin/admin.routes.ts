import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateUserRoleSchema } from '@emp/shared';
import { prisma } from '../../lib/prisma.js';
import { resolveManyMediaUrls } from '../../services/s3.js';

const router = Router();

router.use(requireAuth, requireRole(UserRole.ADMIN));

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isVerified: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ data, total, page, limit, hasMore: page * limit < total });
  }),
);

router.patch(
  '/users/:id/role',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(updateUserRoleSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.params.id! },
      data: { role: req.body.role },
      select: { id: true, username: true, role: true },
    });
    res.json({ user });
  }),
);

router.delete(
  '/users/:id',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.params.id! } });
    res.status(204).end();
  }),
);

router.get(
  '/media',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const where = status ? { moderationStatus: status as any } : {};
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
    res.json({ data: await resolveManyMediaUrls(data), total, page, limit, hasMore: page * limit < total });
  }),
);

export default router;
