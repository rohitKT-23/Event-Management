import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createCommentSchema,
  shareMediaSchema,
  tagUserOnMediaSchema,
  updateCommentSchema,
} from '@emp/shared';
import {
  addComment,
  deleteComment,
  favouriteMedia,
  likeMedia,
  listComments,
  listLikes,
  listMediaTags,
  removeTag,
  shareMedia,
  tagUserOnMedia,
  unfavouriteMedia,
  unlikeMedia,
  updateComment,
} from './social.service.js';

// Media-scoped routes — mounted at /api/v1/media
export const mediaSocialRouter = Router();
const idParam = z.object({ id: z.string().min(20) });

mediaSocialRouter.post('/:id/like', requireAuth, validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const like = await likeMedia(req.params.id!, req.user!.id);
  res.status(201).json({ like });
}));

mediaSocialRouter.delete('/:id/like', requireAuth, validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await unlikeMedia(req.params.id!, req.user!.id);
  res.status(204).end();
}));

mediaSocialRouter.get('/:id/likes', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
  const result = await listLikes(req.params.id!, page, limit);
  res.json({ ...result, page, limit, hasMore: page * limit < result.total });
}));

mediaSocialRouter.post('/:id/comment', requireAuth, validate(idParam, 'params'), validate(createCommentSchema), asyncHandler(async (req, res) => {
  const comment = await addComment(req.params.id!, req.user!.id, req.body);
  res.status(201).json({ comment });
}));

mediaSocialRouter.get('/:id/comments', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 60);
  const result = await listComments(req.params.id!, page, limit);
  res.json({ ...result, page, limit, hasMore: page * limit < result.total });
}));

mediaSocialRouter.post('/:id/share', requireAuth, validate(idParam, 'params'), validate(shareMediaSchema), asyncHandler(async (req, res) => {
  const share = await shareMedia(req.params.id!, req.user!.id, req.body.platform);
  res.status(201).json({ share });
}));

mediaSocialRouter.post('/:id/favourite', requireAuth, validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const fav = await favouriteMedia(req.params.id!, req.user!.id);
  res.status(201).json({ favourite: fav });
}));

mediaSocialRouter.delete('/:id/favourite', requireAuth, validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await unfavouriteMedia(req.params.id!, req.user!.id);
  res.status(204).end();
}));

mediaSocialRouter.post('/:id/tag', requireAuth, validate(idParam, 'params'), validate(tagUserOnMediaSchema), asyncHandler(async (req, res) => {
  const tag = await tagUserOnMedia(
    req.params.id!,
    req.body.taggedUserId,
    req.user!.id,
    req.body.xPercent,
    req.body.yPercent,
  );
  res.status(201).json({ tag });
}));

mediaSocialRouter.delete('/:id/tag/:tagId', requireAuth, validate(z.object({ id: z.string().min(20), tagId: z.string().min(20) }), 'params'), asyncHandler(async (req, res) => {
  await removeTag(req.params.tagId!, req.user!.id, req.user!.role);
  res.status(204).end();
}));

mediaSocialRouter.get('/:id/tags', validate(idParam, 'params'), asyncHandler(async (req, res) => {
  const tags = await listMediaTags(req.params.id!);
  res.json({ tags });
}));

// Standalone comment routes — mounted at /api/v1/comments
export const commentsRouter = Router();

commentsRouter.patch('/:id', requireAuth, validate(idParam, 'params'), validate(updateCommentSchema), asyncHandler(async (req, res) => {
  const comment = await updateComment(req.params.id!, req.body.content, req.user!.id, req.user!.role);
  res.json({ comment });
}));

commentsRouter.delete('/:id', requireAuth, validate(idParam, 'params'), asyncHandler(async (req, res) => {
  await deleteComment(req.params.id!, req.user!.id, req.user!.role);
  res.status(204).end();
}));
