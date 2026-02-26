import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
      // Socket.io uses its own path for the handshake and transport.
      // Without this proxy entry the WebSocket upgrade request would fail
      // in development because the browser is talking to :5173 (Vite) but
      // Socket.io is listening on :3001 (Express).
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true, // enable WebSocket proxying
      },
    },
  },
});
