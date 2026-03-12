import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// When running inside Docker the proxy must target the 'api' service by name,
// not localhost.  Set API_URL in the container's environment (e.g. via
// docker-compose) to override the default local dev value.
const apiTarget = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Alfira',
        short_name: 'Alfira',
        description: 'A self-hosted Discord music bot with a web UI',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Exclude auth, API, and socket.io routes from the navigation fallback
        // so the service worker doesn't serve cached index.html for requests
        // that must reach the backend server.
        navigateFallbackDenylist: [/^\/auth\//, /^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 3600, // 1 hour
              },
            },
          },
        ],
      },
    }),
  ],
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
