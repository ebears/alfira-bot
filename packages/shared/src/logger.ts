import pino from 'pino';

// Browser-safe logger initialization
// In browser, use info level; in Node.js, respect LOG_LEVEL env var
const isBrowser = 'document' in globalThis;

export const logger = pino({
  level: isBrowser ? 'info' : (process.env.LOG_LEVEL ?? 'info'),
});
