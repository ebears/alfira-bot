import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// errorHandler
//
// A catch-all Express error handler. Register this last, after all routes.
// Any route that calls next(error) or throws inside an async wrapper lands here.
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
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error('Unhandled error:', err);
  }

  res.status(status).json({ error: message });
}

// ---------------------------------------------------------------------------
// asyncHandler
//
// Wraps an async route handler so that any thrown error is forwarded to
// next() automatically. Without this, unhandled promise rejections in async
// route handlers silently fail in Express 4.
//
// Usage:
//   router.get('/path', asyncHandler(async (req, res) => { ... }));
// ---------------------------------------------------------------------------
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
