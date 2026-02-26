alfira-bot
==========

## Overview

`alfira-bot` is a self-hosted **Discord music bot** with a **web UI as the primary interface**.  
The bot handles joining voice channels and audio playback; the web app handles browsing songs,
managing playlists, and controlling playback in real time.

For a full technical deep-dive (types, routes, flows, and build phases), see  
`docs/OUTLINE.md`.

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

## Packages & structure (monorepo)

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

## Local development

### 1. Start PostgreSQL

Use the dev `docker-compose.yml` (database only):

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with credentials matching `packages/api/.env.example`.

### 2. Configure environment variables

Copy and fill in:

- `packages/api/.env` (from `.env.example`) – database URL, Discord OAuth credentials,
  JWT secret, guild ID, admin role IDs, `WEB_UI_ORIGIN`, etc.
- `packages/bot/.env` (optional, mainly for local command deployment).

At minimum, you will need values from the
[Discord Developer Portal](https://discord.com/developers/applications) and your guild/role IDs.

### 3. Run migrations and generate Prisma client

```bash
npm run db:generate
npm run db:migrate
```

### 4. Run API + bot and web UI

In one terminal (API + bot):

```bash
npm run dev
```

In another terminal (web UI):

```bash
npm run web:dev
```

The default dev URLs are:

- API + auth + Socket.io: `http://localhost:3001`
- Web UI: `http://localhost:5173`

## Docker deployment

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

### Locking down internal services (recommended)

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
networking, rather than directly over the public internet.

## GitHub Actions & container images

The workflow at `.github/workflows/docker-build.yml`:

- Builds **API + bot** from `Dockerfile.api` and tags:
  - `ghcr.io/<owner>/alfira-bot-api:latest`
  - `ghcr.io/<owner>/alfira-bot-api:<git-sha>`
- Builds **web** from `Dockerfile.web` and tags:
  - `ghcr.io/<owner>/alfira-bot-web:latest`
  - `ghcr.io/<owner>/alfira-bot-web:<git-sha>`
- Logs in to GitHub Container Registry (GHCR) using `GITHUB_TOKEN` and pushes the images.

Make sure the repository allows **write** access for `GITHUB_TOKEN` under  
Settings → Actions → General → Workflow permissions.

## Further reading

- `docs/OUTLINE.md` – complete architecture and build phases, including detailed
  type definitions, endpoint contracts, and real-time event flows.
- `OPERATIONS.md` – operational runbooks for production, including how to apply
  Prisma migrations with the `migrate` service or a one-off container.
