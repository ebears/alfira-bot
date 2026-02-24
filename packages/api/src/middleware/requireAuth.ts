import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// User payload shape — matches what auth.ts encodes into the JWT.
// Declared here and re-used by requireAdmin.
// ---------------------------------------------------------------------------
export interface UserPayload {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Augment Express's Request type so req.user is available in all route
// handlers without needing a cast.
// ---------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// requireAuth
//
// Reads the JWT from the HttpOnly 'session' cookie, verifies it, and
// attaches the decoded payload to req.user. Returns 401 if the token is
// missing or invalid (expired, tampered, wrong secret).
// ---------------------------------------------------------------------------
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const { JWT_SECRET } = process.env;

  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not set — cannot verify tokens.');
    res.status(500).json({ error: 'Server misconfiguration.' });
    return;
  }

  const token = req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated. Please log in at /auth/login.' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = payload;
    next();
  } catch {
    // Token is expired, tampered with, or signed with the wrong secret.
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}
