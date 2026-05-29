/**
 * Standalone worker process. Run alongside the API in production
 * (separate container) so heavy CPU work (sharp, AI calls) doesn't
 * block request handling.
 */
import { logger } from './lib/logger.js';
import { startMediaProcessingWorker } from './workers/mediaProcessing.js';
import { startWatermarkWorker } from './workers/watermark.js';
import { startEmailWorker } from './workers/email.js';

const workers = [startMediaProcessingWorker(), startWatermarkWorker(), startEmailWorker()];

logger.info({ count: workers.length }, 'workers started');

async function shutdown(signal: string) {
  logger.info({ signal }, 'worker shutting down');
  await Promise.allSettled(workers.map((w) => w.close()));
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
