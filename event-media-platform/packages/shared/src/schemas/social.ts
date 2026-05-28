import { z } from 'zod';
import { SharePlatform } from '../enums.js';

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().min(20).optional(),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const shareMediaSchema = z.object({
  platform: z.enum([
    SharePlatform.LINK,
    SharePlatform.INSTAGRAM,
    SharePlatform.TWITTER,
    SharePlatform.WHATSAPP,
  ]),
});

export const tagUserOnMediaSchema = z.object({
  taggedUserId: z.string().min(20),
  xPercent: z.number().min(0).max(100),
  yPercent: z.number().min(0).max(100),
});
