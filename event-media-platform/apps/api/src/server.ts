import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { initSocket } from './services/socket.js';

const app = createApp();
const server = http.createServer(app);

initSocket(server);

server.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${env.API_PORT}`);
  logger.info(`Swagger UI: http://localhost:${env.API_PORT}/docs`);
});

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close((err) => {
    if (err) logger.error({ err }, 'shutdown error');
    process.exit(err ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'uncaughtException'));
