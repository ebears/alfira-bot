import type { NextFunction, Request, Response } from 'express';
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

/**
 * Verifies a JWT session token and returns the decoded payload.
 * Returns null if JWT_SECRET is not set or the token is invalid.
 */
export function verifySessionToken(token: string): UserPayload | null {
  const { JWT_SECRET } = process.env;
  if (!JWT_SECRET) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
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
  const token = req.cookies?.session;

  if (!token) {
    res.status(401).json({ error: 'Not authenticated. Please log in at /auth/login.' });
    return;
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  req.user = payload;
  next();
}
