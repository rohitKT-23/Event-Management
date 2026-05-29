/**
 * Standalone worker process. Run alongside the API in production
 * (separate container) so heavy CPU work (sharp, AI calls) doesn't
 * block request handling.
 */
import { logger } from './lib/logger.js';
import { startMediaProcessingWorker } from './workers/mediaProcessing.js';
import { startWatermarkWorker } from './workers/watermark.js';
import { startEmailWorker } from './workers/email.js';
import { startCronJobs } from './services/cron.js';

const workers = [startMediaProcessingWorker(), startWatermarkWorker(), startEmailWorker()];
const cronTasks = startCronJobs();

logger.info({ count: workers.length, cron: cronTasks.length }, 'workers started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  cronTasks.forEach((t) => t.stop());
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
