import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// When running inside Docker the proxy must target the 'api' service by name,
// not localhost.  Set API_URL in the container's environment (e.g. via
// docker-compose) to override the default local dev value.
const apiTarget = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to 0.0.0.0 so Docker can expose the port to the host machine.
    // This is a no-op (and harmless) when running Vite directly on the host.
    host: true,
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/auth': apiTarget,
      // Socket.io uses its own path for the handshake and transport.
      // Without this proxy entry the WebSocket upgrade request would fail
      // in development because the browser is talking to :5173 (Vite) but
      // Socket.io is listening on :3001 (Express).
      '/socket.io': {
        target: apiTarget,
        ws: true, // enable WebSocket proxying
      },
    },
  },
});
