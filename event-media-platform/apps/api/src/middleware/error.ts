import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError, NotFoundError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Zod validation error → 400 with flattened details
  if (err instanceof ZodError) {
    res.status(400).json({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.flatten(),
    });
    return;
  }

  // Prisma known errors → 4xx where applicable
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        status: 409,
        code: 'UNIQUE_VIOLATION',
        message: 'A record with these unique fields already exists',
        details: err.meta,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ status: 404, code: 'NOT_FOUND', message: 'Record not found' });
      return;
    }
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({
      status: err.status,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error({ err, path: req.originalUrl }, 'unhandled error');
  res.status(500).json({
    status: 500,
    code: 'INTERNAL',
    message: isProd ? 'Internal server error' : (err instanceof Error ? err.message : String(err)),
    ...(isProd ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });
};
