/**
 * Scheduled jobs (node-cron). Runs inside the worker process so it shares
 * the same Redis-backed email queue. All jobs are best-effort: failures are
 * logged and never crash the worker.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { enqueueWeeklyDigestForUser } from './email/digest.js';

// Sunday 09:00 in Asia/Kolkata (IST). node-cron supports IANA timezones.
const WEEKLY_DIGEST_CRON = '0 9 * * 0';

export async function runWeeklyDigest(): Promise<void> {
  logger.info('cron: weekly digest run started');
  let processed = 0;
  const batchSize = 500;
  let cursor: string | undefined;

  // Paginate over active users so a large user base doesn't blow memory.
  for (;;) {
    const users: { id: string }[] = await prisma.user.findMany({
      where: { isVerified: true },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (users.length === 0) break;

    for (const u of users) {
      try {
        await enqueueWeeklyDigestForUser(u.id);
        processed += 1;
      } catch (err) {
        logger.warn({ err, userId: u.id }, 'cron: failed to enqueue digest for user');
      }
    }
    cursor = users[users.length - 1]!.id;
    if (users.length < batchSize) break;
  }

  logger.info({ processed }, 'cron: weekly digest run complete');
}

export function startCronJobs(): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];

  tasks.push(
    cron.schedule(
      WEEKLY_DIGEST_CRON,
      () => {
        runWeeklyDigest().catch((err) => logger.error({ err }, 'cron: weekly digest failed'));
      },
      { timezone: 'Asia/Kolkata' },
    ),
  );

  logger.info({ count: tasks.length }, 'cron jobs scheduled');
  return tasks;
}
