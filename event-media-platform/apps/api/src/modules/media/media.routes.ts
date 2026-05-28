import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  finalizeUploadSchema,
  presignedUrlRequestSchema,
  updateMediaSchema,
} from '@emp/shared';
import {
  deleteMedia,
  finalizeUpload,
  generatePresignedUpload,
  getMedia,
  getUploadStatus,
  requestDownload,
  updateMedia,
} from './media.service.js';

const router = Router();

router.post(
  '/presigned-url',
  requireAuth,
  validate(presignedUrlRequestSchema),
  asyncHandler(async (req, res) => {
    const result = await generatePresignedUpload({ ...req.body, uploaderId: req.user!.id });
    res.json(result);
  }),
);

router.post(
  '/upload',
  requireAuth,
  validate(finalizeUploadSchema),
  asyncHandler(async (req, res) => {
    const result = await finalizeUpload({ ...req.body, uploaderId: req.user!.id });
    res.status(202).json({ media: result });
  }),
);

router.post(
  '/upload-bulk',
  requireAuth,
  validate(z.object({ items: z.array(finalizeUploadSchema).min(1).max(50) })),
  asyncHandler(async (req, res) => {
    const items = (req.body as { items: any[] }).items;
    const results = await Promise.all(
      items.map((it) => finalizeUpload({ ...it, uploaderId: req.user!.id })),
    );
    res.status(202).json({ media: results });
  }),
);

router.get(
  '/upload-status/:jobId',
  requireAuth,
  validate(z.object({ jobId: z.string().min(1) }), 'params'),
  asyncHandler(async (req, res) => {
    res.json(await getUploadStatus(req.params.jobId!));
  }),
);

router.get(
  '/:id',
  optionalAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const media = await getMedia(req.params.id!, req.user?.id);
    res.json({ media });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(updateMediaSchema),
  asyncHandler(async (req, res) => {
    const media = await updateMedia(req.params.id!, req.body, req.user!.id, req.user!.role);
    res.json({ media });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteMedia(req.params.id!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

router.get(
  '/:id/download',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const result = await requestDownload(req.params.id!, req.user!.id);
    res.json(result);
  }),
);

export default router;
