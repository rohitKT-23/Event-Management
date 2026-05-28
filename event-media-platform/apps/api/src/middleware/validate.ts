import type { Request, RequestHandler } from 'express';
import { z, type ZodTypeAny } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * `validate(schema, 'body' | 'query' | 'params')` parses + replaces
 * `req[target]` with the typed result. Throws `ZodError` on failure,
 * which the error handler converts to a 400 response.
 */
export function validate<T extends ZodTypeAny>(
  schema: T,
  target: ValidationTarget = 'body',
): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse((req as Request & Record<string, unknown>)[target]);
    (req as Request & Record<string, unknown>)[target] = parsed;
    next();
  };
}

export const objectIdSchema = z.string().min(20).max(40);
