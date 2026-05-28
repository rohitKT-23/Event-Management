import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { UserRole } from '@prisma/client';
import { addMemberSchema, createClubSchema, updateClubSchema } from '@emp/shared';
import {
  addClubMember,
  createClub,
  deleteClub,
  getClub,
  listClubMembers,
  listClubs,
  removeClubMember,
  updateClub,
} from './clubs.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const result = await listClubs(page, limit, q);
    res.json({ ...result, page, limit, hasMore: page * limit < result.total });
  }),
);

router.get(
  '/:id',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const club = await getClub(req.params.id!);
    res.json({ club });
  }),
);

router.post(
  '/',
  requireAuth,
  requireRole(UserRole.PHOTOGRAPHER, UserRole.ADMIN),
  validate(createClubSchema),
  asyncHandler(async (req, res) => {
    const club = await createClub(req.body, req.user!.id, req.user!.role);
    res.status(201).json({ club });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(updateClubSchema),
  asyncHandler(async (req, res) => {
    const club = await updateClub(req.params.id!, req.body, req.user!.id, req.user!.role);
    res.json({ club });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await deleteClub(req.params.id!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

router.get(
  '/:id/members',
  validate(z.object({ id: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    const members = await listClubMembers(req.params.id!);
    res.json({ members });
  }),
);

router.post(
  '/:id/members',
  requireAuth,
  validate(z.object({ id: z.string().min(20) }), 'params'),
  validate(addMemberSchema),
  asyncHandler(async (req, res) => {
    const m = await addClubMember(
      req.params.id!,
      req.body.userId,
      req.body.role,
      req.user!.id,
      req.user!.role,
    );
    res.status(201).json({ membership: m });
  }),
);

router.delete(
  '/:id/members/:userId',
  requireAuth,
  validate(z.object({ id: z.string().min(20), userId: z.string().min(20) }), 'params'),
  asyncHandler(async (req, res) => {
    await removeClubMember(req.params.id!, req.params.userId!, req.user!.id, req.user!.role);
    res.status(204).end();
  }),
);

export default router;
