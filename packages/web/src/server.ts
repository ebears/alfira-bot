const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
const PORT = Number(process.env.PORT) || 5173;

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Proxy API requests
    if (pathname.startsWith('/api')) {
      const target = `${apiUrl}${pathname}${url.search}`;
      const response = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      } as RequestInit);
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Proxy auth requests
    if (pathname.startsWith('/auth')) {
      const target = `${apiUrl}${pathname}${url.search}`;
      const response = await fetch(target, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
      } as RequestInit);
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Proxy WebSocket upgrade for /ws
    if (pathname.startsWith('/ws')) {
      const target = `${apiUrl}${pathname}${url.search}`.replace('http', 'ws');
      try {
        // biome-ignore lint/suspicious/noExplicitAny: Bun's WebSocket upgrade requires Bun's WebSocket type
        const ws = await (WebSocket as any).upgrade(req, {
          headers: Object.fromEntries(req.headers),
        });
        // biome-ignore lint/suspicious/noExplicitAny: Bun's WebSocket constructor requires Bun's WebSocket type
        const remote = new (WebSocket as any)(target);
        ws.onopen = () => remote.close();
        ws.onclose = () => remote.close();
        ws.onmessage = (event: MessageEvent) => remote.send(event.data);
        remote.onmessage = (event: MessageEvent) => ws.send(event.data);
        return new Response(null, { status: 200 });
      } catch {
        return new Response('WebSocket upgrade failed', { status: 502 });
      }
    }

    // Serve static files
    if (pathname === '/' || !pathname.includes('.')) {
      const index = Bun.file('./index.html');
      if (await index.exists()) {
        return new Response(index, {
          headers: { 'Content-Type': 'text/html' },
        });
      }
    }

    const filePath = `./public${pathname}`;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
      };
      const ext = filePath.slice(filePath.lastIndexOf('.'));
      return new Response(file, {
        headers: { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream' },
      });
    }

    // Fallback to index.html for SPA routing
    const indexFallback = Bun.file('./index.html');
    if (await indexFallback.exists()) {
      return new Response(indexFallback, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`[Dev] Server running on http://localhost:${PORT}`);
console.log(`[Dev] Proxying /api, /auth, /ws to ${apiUrl}`);
