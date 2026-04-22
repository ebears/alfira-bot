import type { RouteContext } from '../index';
import { json } from '../lib/json';
import { db, tables } from '../shared/db';

const { tag: tagTable } = tables;

export async function handleTags(ctx: RouteContext, request: Request): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }

  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/tags') {
    const tags = await db
      .select({ canonicalName: tagTable.canonicalName, nameLower: tagTable.nameLower })
      .from(tagTable)
      .orderBy(tagTable.canonicalName)
      .all();

    return json({ tags });
  }

  return json({ error: 'Not Found' }, 404);
}
