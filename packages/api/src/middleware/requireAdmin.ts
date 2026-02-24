import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// requireAdmin
//
// Must be used after requireAuth — it assumes req.user has already been set.
// Returns 403 if the authenticated user does not have admin status.
//
// Admin status is determined at login time and encoded in the JWT, so role
// changes in Discord take effect on the user's next login.
// ---------------------------------------------------------------------------
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    // requireAdmin was used without requireAuth before it — programming error.
    res.status(500).json({ error: 'requireAdmin used without requireAuth.' });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({ error: 'Admin access required.' });
    return;
  }

  next();
}
