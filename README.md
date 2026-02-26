<p align="center">
  <img width="250" height="250" src="https://raw.githubusercontent.com/ebears/alfira-bot/main/.github/logo.png">
</p>

<h1 align="center">Alfira</h1>

**Alfira** is a self-hosted **Discord music bot** with a **web UI as the primary interface**.  
The bot handles joining voice channels and audio playback; the web app handles browsing songs,
managing playlists, and controlling playback in real time.

## Features

- **Discord bot**
  - Slash commands: `/join`, `/leave`, `/play`, `/skip`, `/stop`, `/queue`, `/loop`, `/shuffle`,
    `/playlist play`, `/nowplaying`.
  - Queue management with loop modes (`off`, `song`, `queue`) and shuffle.
  - Audio playback via `yt-dlp` + `ffmpeg` + `@discordjs/voice`.
- **Web UI**
  - Discord OAuth2 login with role-based permissions (Admin vs Member).
  - Song library: add-by-URL via YouTube, delete, add to playlists (admins only).
  - Playlists: create/delete/rename, add/remove songs, play into the queue with
    sequential/random order and loop mode.
  - Player page + global Now Playing bar with live progress, queue view, and admin controls.
- **Real-time sync**
  - `Socket.io` events keep the UI in sync with the in-memory player state and library changes
    (no polling).
- **Single-guild focus**
  - Scoped to a single Discord server (guild), with admin status determined by Discord role IDs.

## Tech stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (bot, API, web)
- **Discord**: `discord.js` v14, `@discordjs/voice`, `@snazzah/davey`
- **Audio**: `yt-dlp`, `ffmpeg`
- **API**: Express.js
- **Real-time**: Socket.io
- **Database**: PostgreSQL + Prisma
- **Frontend**: React (Vite) + Tailwind CSS

### Structure

The project is an npm workspaces monorepo:

- `packages/shared` – Shared TypeScript types (`Song`, `QueuedSong`, `QueueState`, `Playlist`, etc.).
- `packages/bot` – Discord bot (slash commands, `GuildPlayer`, yt-dlp wrapper).
- `packages/api` – Express API, Prisma, Socket.io server, and bot entrypoint (`src/index.ts`).
- `packages/web` – Vite + React + Tailwind web UI.

Top-level scripts:

- `npm run dev` – Start the API + bot (from `packages/api`).
- `npm run web:dev` – Start the Vite dev server for the web UI.
- `npm run db:generate` – Generate Prisma client.
- `npm run db:migrate` – Run Prisma migrations.

<p align="center">
  <img width="250" src="https://raw.githubusercontent.com/ebears/alfira-bot/main/.github/icon.png">
</p>

<h2 align="center">Setup</h2>

### Local (Development)

**Requirements:** `Docker` (with Compose). No local Node.js, ffmpeg, or yt-dlp installation needed.

#### 1. Configure environment variables

```bash
cp packages/api/.env.example packages/api/.env
cp packages/bot/.env.example packages/bot/.env
```

Fill in both files with values from the
[Discord Developer Portal](https://discord.com/developers/applications) and your guild/role IDs.
At minimum you need `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`,
`GUILD_ID`, and `JWT_SECRET`.

> `DATABASE_URL` is set automatically by Docker Compose and does not need to be in your `.env`.

#### 2. Build images and start all services

```bash
docker compose up --build
```

This builds the API and web images, applies any pending database migrations via the `migrate`
service, and then starts:

- `db` – PostgreSQL 16 on `localhost:5432`
- `api` – Express API + Socket.io + Discord bot on `localhost:3001`
- `web` – Vite dev server on `localhost:5173` (with HMR)

On subsequent starts you can skip the build step:

```bash
docker compose up -d
```

#### 3. Developing

| What changed | Action |
|---|---|
| `packages/web/src/**` | Nothing — Vite HMR applies the change in the browser automatically. |
| `packages/api/src/**` | `docker compose restart api` |
| `packages/bot/src/**` | `docker compose build api && docker compose up -d api` |

The default dev URLs are:

- API + auth + Socket.io: `http://localhost:3001`
- Web UI: `http://localhost:5173`

---

### Docker (Production)

**Requirements:** `Docker`, a reverse proxy (like `Caddy`)

For a containerised deployment of the whole stack (database, API+bot, web) using the
pre-built images published to GHCR:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

This starts:

- `db` – PostgreSQL 16 with a healthcheck.
- `api` – `ghcr.io/ebears/alfira-bot-api` (Express API + Socket.io + Discord bot).
- `web` – `ghcr.io/ebears/alfira-bot-web` (static Vite build served by nginx on port 80).

By default, `docker-compose.prod.yml` maps:

- `api` → `localhost:3001`
- `web` → `localhost:8080`

You can front these with your own reverse proxy (for example, an external Caddy instance)
and set `WEB_UI_ORIGIN` / `DISCORD_REDIRECT_URI` to match the public URL, such as:

- `WEB_UI_ORIGIN=http://musicbot.example.com`
- `DISCORD_REDIRECT_URI=http://musicbot.example.com/auth/callback`

#### Locking down internal services (recommended)

In a production setup where Caddy (or another reverse proxy) runs in Docker too, you will usually
want:

- **PostgreSQL** – No `ports:` published; only the `api` service talks to it over the Docker
  network.
- **API (Node + bot)** – No `ports:` published in production; Caddy proxies `/api`, `/auth`,
  and `/socket.io` to `api:3001` on the internal network instead of exposing `3001:3001` on the
  host.
- **Web (nginx)** – No `ports:` published; Caddy proxies `/` to `web:80` on the internal network.
- **Caddy** – The only service that exposes host ports (typically `80`/`443`) and terminates TLS,
  then forwards to `api`/`web` internally.

This keeps the database, API, and web containers reachable only via your reverse proxy and Docker
networking.

##### Example `Caddyfile` Snippet

```Caddy
https://alfira.website.com {
  reverse_proxy /api* api:3001
  reverse_proxy /auth* api:3001
  reverse_proxy /socket.io* api:3001
  reverse_proxy /* web:8080
}
```

---

### Further Reading

- `docs/OUTLINE.md` – complete architecture and build phases, including detailed
  type definitions, endpoint contracts, and real-time event flows.
- `docs/OPERATIONS.md` – operational runbooks for production, including how to apply
  Prisma migrations with the `migrate` service or a one-off container.

---

### Disclaimer

**YMMV:** This project was written for personal use and with the help of LLMs.
