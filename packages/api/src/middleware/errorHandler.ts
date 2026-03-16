import type { NextFunction, Request, Response } from 'express';
import logger from '../lib/logger';

// ---------------------------------------------------------------------------
// errorHandler
//
// A catch-all Express error handler. Register this last, after all routes.
// Any route that throws (including async route handlers) lands here.
// Express 5 forwards async errors to the error handler automatically.
//
// Produces consistent JSON error responses so the web UI always has a
// predictable shape to parse.
// ---------------------------------------------------------------------------
export function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500;
  const message = status >= 500 ? 'Internal server error' : err.message || 'Internal server error';

  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  }

  res.status(status).json({ error: message });
}
