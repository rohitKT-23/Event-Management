import pino from 'pino';
import { env, isProd } from '../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: env.APP_NAME, env: env.NODE_ENV },
  transport: isProd
    ? undefined
    : { target: 'pino/file', options: { destination: 1, colorize: false } },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.tokenHash',
    ],
    censor: '[REDACTED]',
  },
});
