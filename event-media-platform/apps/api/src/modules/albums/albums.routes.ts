import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { addCollaboratorSchema, createAlbumSchema, updateAlbumSchema } from '@emp/shared';
import {
  addAlbumCollaborator,
  createAlbum,
  deleteAlbum,
  getAlbum,
  listAlbumMedia,
  removeAlbumCollaborator,
  updateAlbum,
} from './albums.service.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  validate(createAlbumSchema),
  asyncHandler(async (req, res) => {
    const album = await createAlbum(req.body, req.user!.id);
    res.status(201).json({ album });
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const album = await getAlbum(req.params.id!);
    res.json({ album });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(updateAlbumSchema),
  asyncHandler(async (req, res) => {
    const album = await updateAlbum(req.params.id!, req.body, req.user!.id, req.user!.role);
    res.json({ album });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteAlbum(req.params.id!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

router.get(
  '/:id/media',
  optionalAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 60);
    const result = await listAlbumMedia(req.params.id!, page, limit, req.user?.id);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.post(
  '/:id/collaborators',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(addCollaboratorSchema),
  asyncHandler(async (req, res) => {
    const collab = await addAlbumCollaborator(
      req.params.id!,
      req.body.userId,
      req.user!.id,
      req.user!.role,
    );
    res.status(201).json({ collaborator: collab });
  }),
);

router.delete(
  '/:id/collaborators/:userId',
  requireAuth,
  validate(z.object({ id: z.string().min(20), userId: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await removeAlbumCollaborator(req.params.id!, req.params.userId!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

export default router;
