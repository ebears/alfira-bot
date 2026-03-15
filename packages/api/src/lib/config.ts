export const WEB_UI_ORIGIN = process.env.WEB_UI_ORIGIN ?? 'http://localhost:5173';

export const GUILD_ID = process.env.GUILD_ID as string;
if (!GUILD_ID) {
  throw new Error('GUILD_ID environment variable is not set');
}
