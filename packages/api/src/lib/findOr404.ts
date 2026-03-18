import type { Response } from 'express';

/**
 * Runs `find()` and sends a 404 JSON response if the result is null.
 * Returns the found value or null (after responding to the client).
 */
export async function findOr404<T>(
  find: () => Promise<T | null>,
  res: Response,
  label: string
): Promise<T | null> {
  const result = await find();
  if (!result) {
    res.status(404).json({ error: `${label} not found.` });
    return null;
  }
  return result;
}
