/**
 * BullMQ worker — sends transactional emails through Resend.
 */
import { Worker, type Job } from 'bullmq';
import { redisQueue } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { deliverEmailJob } from '../services/email/index.js';
import { QUEUE_NAMES, type EmailJob } from '../services/queue.js';

export function startEmailWorker() {
  const worker = new Worker<EmailJob>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJob>) => {
      logger.info({ jobId: job.id, templateId: job.data.templateId, to: job.data.to }, 'processing email job');
      const result = await deliverEmailJob(job.data);
      return { resendId: result?.id ?? null };
    },
    { connection: redisQueue, concurrency: 5 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'email job failed');
  });

  return worker;
}
