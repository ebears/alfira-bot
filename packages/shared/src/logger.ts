import pino from 'pino';

// Browser-safe logger initialization
// In browser, use info level; in Node.js, respect LOG_LEVEL env var
const isBrowser =
  typeof globalThis !== 'undefined' && typeof (globalThis as { window?: unknown }).window !== 'undefined';

export const logger = pino({
  level: isBrowser ? 'info' : (process.env.LOG_LEVEL ?? 'info'),
});
