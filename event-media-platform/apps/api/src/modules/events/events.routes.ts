import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import { asyncHandler } from '../../lib/http.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from '@emp/shared';
import { env } from '../../config/env.js';
import {
  createEvent,
  deleteEvent,
  getEvent,
  getEventAlbums,
  getEventMedia,
  listEvents,
  updateEvent,
} from './events.service.js';

const router = Router();

router.get(
  '/',
  optionalAuth,
  validate(listEventsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ReturnType<typeof listEventsQuerySchema.parse>;
    const result = await listEvents({
      clubId: q.clubId,
      category: q.category,
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      q: q.q,
      isPublicOnly: !req.user,
      page: q.page,
      limit: q.limit,
    });
    res.json({ ...result, page: q.page, limit: q.limit, hasMore: q.page * q.limit < result.total });
  }),
);

router.get(
  '/:id',
  optionalAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const event = await getEvent(req.params.id!, req.user?.id, req.user?.role);
    res.json({ event });
  }),
);

router.post(
  '/',
  requireAuth,
  validate(createEventSchema),
  asyncHandler(async (req, res) => {
    const event = await createEvent(req.body, req.user!.id, req.user!.role);
    res.status(201).json({ event });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(updateEventSchema),
  asyncHandler(async (req, res) => {
    const event = await updateEvent(req.params.id!, req.body, req.user!.id, req.user!.role);
    res.json({ event });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteEvent(req.params.id!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

router.get(
  '/:id/albums',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const albums = await getEventAlbums(req.params.id!);
    res.json({ albums });
  }),
);

router.get(
  '/:id/media',
  optionalAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 60);
    const result = await getEventMedia(req.params.id!, page, limit, req.user?.id);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

// QR code for album sharing — generates a PNG data URL for an album-deep-link
router.post(
  '/:id/qr',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const url = `${env.WEB_BASE_URL}/qr/${req.params.id}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
    res.json({ url, qr: dataUrl });
  }),
);

export default router;
