/**
 * Express application factory. Wires every module, middleware,
 * and error handler. Imported by both `server.ts` (HTTP+sockets)
 * and tests.
 */
import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { corsOrigins, env, isProd } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { generalLimiter } from './middleware/rateLimit.js';

import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import clubsRoutes from './modules/clubs/clubs.routes.js';
import eventsRoutes from './modules/events/events.routes.js';
import albumsRoutes from './modules/albums/albums.routes.js';
import mediaRoutes from './modules/media/media.routes.js';
import { mediaSocialRouter, commentsRouter } from './modules/social/social.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import storiesRoutes from './modules/stories/stories.routes.js';

import { openApiSpec } from './lib/openapi.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    morgan(isProd ? 'combined' : 'dev', {
      skip: (req) => req.url === '/health' || req.url === '/health/ready',
    }),
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: env.APP_NAME, env: env.NODE_ENV }));
  app.get('/health/ready', (_req, res) => res.json({ ready: true }));

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use('/api/v1', generalLimiter);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/clubs', clubsRoutes);
  app.use('/api/v1/events', eventsRoutes);
  app.use('/api/v1/albums', albumsRoutes);
  app.use('/api/v1/media', mediaRoutes);
  app.use('/api/v1/media', mediaSocialRouter);
  app.use('/api/v1/comments', commentsRouter);
  app.use('/api/v1/search', searchRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/stories', storiesRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
