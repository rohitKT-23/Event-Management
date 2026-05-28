import type { NextFunction, Request, Response } from 'express';

/**
 * `asyncHandler` wraps an async route handler so thrown errors
 * propagate to the central error middleware. Express 4 doesn't
 * forward Promise rejections automatically.
 */
export function asyncHandler<R extends Request = Request>(
  fn: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as R, res, next)).catch(next);
  };
}

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return {
    data,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}
