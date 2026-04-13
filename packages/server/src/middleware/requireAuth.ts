import type { User } from '../shared';
import jwt from 'jsonwebtoken';

/**
 * Verifies a JWT session token and returns the decoded payload.
 * Returns null if JWT_SECRET is not set or the token is invalid.
 */
export function verifySessionToken(token: string): User | null {
  const { JWT_SECRET } = process.env;
  if (!JWT_SECRET) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as User;
  } catch {
    return null;
  }
}
