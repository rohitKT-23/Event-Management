/**
 * BullMQ queue producers. Workers live in `src/workers/`.
 *
 * Queues:
 *  - media-processing : compression, thumbnail, pHash, AI tagging, moderation,
 *                       caption generation, face indexing for each upload.
 *  - watermark         : on-demand watermark rendering for downloads.
 *  - email             : transactional emails (verify, reset, digest).
 */
import { Queue, type JobsOptions } from 'bullmq';
import { redisQueue } from '../lib/redis.js';

export const QUEUE_NAMES = {
  MEDIA: 'media-processing',
  WATERMARK: 'watermark',
  EMAIL: 'email',
} as const;

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

export const mediaQueue = new Queue(QUEUE_NAMES.MEDIA, {
  connection: redisQueue,
  defaultJobOptions,
});

export const watermarkQueue = new Queue(QUEUE_NAMES.WATERMARK, {
  connection: redisQueue,
  defaultJobOptions,
});

export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection: redisQueue,
  defaultJobOptions,
});

// Job payload types
export type MediaProcessingJob = {
  mediaId: string;
  bucket: string;
  key: string;
  uploaderId: string;
};

export type WatermarkJob = {
  mediaId: string;
  userId: string;
};

export type EmailTemplateId = 'password-reset' | 'verify-email' | 'weekly-digest';

export type EmailJob = {
  to: string;
  templateId: EmailTemplateId;
  vars: Record<string, string>;
  idempotencyKey?: string;
};

export async function enqueueMediaProcessing(payload: MediaProcessingJob, jobId?: string) {
  return mediaQueue.add('process', payload, { jobId });
}

export async function enqueueWatermark(payload: WatermarkJob) {
  return watermarkQueue.add('apply', payload);
}

export async function enqueueEmail(payload: EmailJob, options?: { jobId?: string }) {
  return emailQueue.add('send', payload, options?.jobId ? { jobId: options.jobId } : undefined);
}
