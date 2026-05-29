import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createStory, deleteStory, getStory, listEventStories } from './stories.service.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  validate(
    z.object({
      eventId: z.string().min(20),
      mediaIds: z.array(z.string().min(20)).min(1).max(30),
    }),
  ),
  asyncHandler(async (req, res) => {
    const story = await createStory(req.body.eventId, req.body.mediaIds, req.user!.id);
    res.status(201).json({ story });
  }),
);

router.get(
  '/',
  validate(z.object({ eventId: z.string().min(20) }), 'query'),
  asyncHandler(async (req, res) => {
    const stories = await listEventStories(req.query.eventId as string);
    res.json({ stories });
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const story = await getStory(req.params.id!);
    res.json({ story });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteStory(req.params.id!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

export default router;
