# PWA Service Worker — Installable App Support

## Status

Approved

## Context

The web package has a partial PWA setup that is not functional:
- `manifest.webmanifest` exists with icons
- `public/sw.js` is a stub that actively unregisters itself
- `ThemeContext.tsx` tries to update `meta[name="theme-color"]` but the tag doesn't exist in HTML
- No service worker is registered

The goal is minimal PWA support: make the app installable on mobile/desktop browsers without adding offline functionality.

## Design

### What "installable" requires

A PWA needs three things to be installable:
1. A valid `manifest.webmanifest` — already exists in `public/`
2. A service worker that controls the page — needs to be registered and active
3. HTTPS — handled by the deployment environment

No caching or offline features needed.

### Changes

#### 1. Register `sw.js` in `main.tsx`

Add service worker registration after DOM is ready:

```ts
// packages/web/src/main.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

#### 2. Replace `sw.js` stub with a controlling service worker

Replace the self-unregistering stub with a minimal controlling SW:

```js
// packages/web/public/sw.js
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  console.log('Service worker activated');
});
```

This is the minimum needed for a SW to control the page. `skipWaiting()` ensures the new SW activates immediately. `clients.claim()` ensures the SW starts controlling existing pages immediately.

#### 3. Add `meta[name="theme-color"]` to HTML

Add to `packages/web/index.html` `<head>`:

```html
<meta name="theme-color" content="#282828" />
```

Default to dark elevated (`#282828`) to match the dark theme default. Content is a hex value matching `bg-elevated` in dark mode.

#### 4. ThemeContext update `meta[name="theme-color"]`

The existing code in `ThemeContext.tsx` (lines 177-185) already attempts to update the theme-color meta tag based on `--color-elevated`. With the meta tag now present in HTML, this code will work automatically on theme changes.

The existing code reads the CSS variable and sets the content — no changes needed to the implementation.

### Files touched

- `packages/web/src/main.tsx` — add SW registration
- `packages/web/public/sw.js` — replace stub with controlling SW
- `packages/web/index.html` — add theme-color meta tag

### No changes to

- Build process (`bun build` stays the same)
- Dependencies (no new packages)
- API package
- Database
- Bot package

### Verification

1. Build the web package: `bun run web:build`
2. Serve the app and open DevTools → Application → Service Workers — should show `sw.js` as activated and controlling
3. In Chrome DevTools → Application → Manifest — should show no errors
4. On mobile, "Add to Home Screen" prompt should appear (or be available in browser menu)
5. Change color theme and verify `meta[name="theme-color"]` content updates to match new `bg-elevated`
