import type { RequestHandler } from 'express';
import { nanoid } from 'nanoid';

/**
 * Tag every request with a stable id so we can correlate logs
 * across the request/response cycle and across services.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length ? incoming : nanoid(12);
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
