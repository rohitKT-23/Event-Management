/**
 * Domain error hierarchy. The error handler middleware maps each
 * subclass to an HTTP status + JSON body. Always throw a specific
 * `HttpError` subclass instead of a bare `Error` so the response
 * is consistent.
 */

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'You do not have permission to perform this action') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'UNPROCESSABLE', message, details);
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests') {
    super(429, 'RATE_LIMIT', message);
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal server error') {
    super(500, 'INTERNAL', message);
  }
}
