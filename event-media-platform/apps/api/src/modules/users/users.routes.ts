import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { updateUserSchema, paginationSchema } from '@emp/shared';
import {
  deleteMyAccount,
  finalizeSelfie,
  getPublicUser,
  getSelfieUploadUrl,
  listMyFaceMatchedPhotos,
  listMyFavourites,
  listMyNotifications,
  listMySelfies,
  listMyUploads,
  markAllNotificationsRead,
  updateMyProfile,
} from './users.service.js';

const router = Router();

router.get(
  '/me/favourites',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await listMyFavourites(req.user!.id, page, limit);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.get(
  '/me/uploads',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await listMyUploads(req.user!.id, page, limit);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.get(
  '/me/notifications',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await listMyNotifications(req.user!.id, page, limit);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.patch(
  '/me/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await markAllNotificationsRead(req.user!.id);
    res.status(204).end();
  }),
);

router.get(
  '/me/my-photos',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await listMyFaceMatchedPhotos(req.user!.id, page, limit);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.post(
  '/me/selfie/presigned-url',
  requireAuth,
  validate(z.object({ contentType: z.string().regex(/^image\//) })),
  asyncHandler(async (req, res) => {
    const result = await getSelfieUploadUrl(req.user!.id, req.body.contentType);
    res.json(result);
  }),
);

router.post(
  '/me/selfie',
  requireAuth,
  validate(z.object({ s3Key: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const result = await finalizeSelfie(req.user!.id, req.body.s3Key);
    res.status(201).json(result);
  }),
);

router.get(
  '/me/selfies',
  requireAuth,
  asyncHandler(async (req, res) => {
    const selfies = await listMySelfies(req.user!.id);
    res.json({ data: selfies });
  }),
);

router.patch(
  '/me',
  requireAuth,
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateMyProfile(req.user!.id, req.body);
    res.json({ user });
  }),
);

router.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteMyAccount(req.user!.id);
    res.status(204).end();
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const user = await getPublicUser(req.params.id!);
    res.json({ user });
  }),
);

export default router;
