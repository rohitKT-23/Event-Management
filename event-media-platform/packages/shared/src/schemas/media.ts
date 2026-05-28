import { z } from 'zod';
import { ModerationStatus } from '../enums.js';

export const presignedUrlRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(120),
  size: z.number().int().min(1).max(500 * 1024 * 1024), // 500 MB hard cap
  albumId: z.string().min(20).optional(),
  eventId: z.string().min(20).optional(),
});
export type PresignedUrlRequest = z.infer<typeof presignedUrlRequestSchema>;

export const finalizeUploadSchema = z.object({
  s3Key: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().min(1),
  albumId: z.string().min(20).optional(),
  eventId: z.string().min(20).optional(),
});

export const updateMediaSchema = z.object({
  aiCaption: z.string().max(500).optional(),
  aiTags: z.array(z.string()).max(50).optional(),
  isPublic: z.boolean().optional(),
});

export const moderationDecisionSchema = z.object({
  status: z.enum([ModerationStatus.APPROVED, ModerationStatus.REJECTED]),
  reason: z.string().max(500).optional(),
});

export const searchMediaQuerySchema = z.object({
  q: z.string().optional(),
  type: z.enum(['media', 'event', 'user']).default('media'),
  tags: z.string().optional(), // comma-separated
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  eventId: z.string().optional(),
  uploader: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(20),
});
