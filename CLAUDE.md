# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alfira is a self-hosted Discord music bot with a web UI as the primary interface. It's a Bun workspaces monorepo with four packages:

- `packages/shared` — Shared types, utilities, DB schema, and logger
- `packages/bot` — Discord bot (`GuildPlayer`, NodeLink audio via `hoshimi`)
- `packages/api` — Bun API server (HTTP + WebSocket, Drizzle ORM)
- `packages/web` — React 19 + Tailwind CSS 4 web UI

The bot and API run in a **single Bun process** started from `packages/api/src/index.ts`. They share memory for player state, enabling real-time WebSocket broadcasts directly from playback events.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Discord:** discord.js v14
- **Audio:** NodeLink (Lavalink v4-compatible) via `hoshimi` v0.3
- **API:** Bun native HTTP + WebSocket
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Frontend:** React 19 + Tailwind CSS 4
- **Linting:** Biome

## Development Commands

```bash
# Build shared + bot dist/, then start all services with Docker
bun run dev

# Build the web UI (needed after web/src changes before docker compose restart)
bun run web:build

# Generate Drizzle migration files
bun run db:generate

# Run Drizzle migrations
bun run db:migrate

# Lint + format with auto-fix (run before committing)
bun run check

# Lint only, with auto-fix
bun run lint:fix

# Format only, with auto-fix
bun run format
```

## Key Architecture Notes

### Single-Process Startup Sequence (packages/api/src/index.ts)

1. Run database migrations (homegrown, reads `packages/shared/dist/db/migrations/*.sql`)
2. Verify database connectivity
3. Call `setBroadcastQueueUpdate(emitPlayerUpdate)` — injects the WebSocket broadcaster into the bot package
4. Call `startBot()` — initializes Discord client + Hoshimi + NodeLink connection
5. Start Bun HTTP server on port 3001 (serves API routes, WebSocket at `/ws`, and static web assets from `packages/web/dist/`)

### Real-Time Updates (WebSocket Pipeline)

The bot never directly holds WebSocket connections. Instead:

1. `GuildPlayer` calls `broadcastQueueUpdate(state)` (packages/bot/src/lib/broadcast.ts)
2. `broadcastQueueUpdate` calls the injected `emitPlayerUpdate(state)` function
3. `emitPlayerUpdate` (packages/api/src/lib/socket.ts) sends to all registered WebSocket clients

WebSocket clients authenticate via session cookie on connection. The client never sends messages — it's receive-only.

### Bot Changes Require Rebuild

The bot is compiled to `packages/bot/dist/` during Docker image build. If you change `packages/bot/src/**`, run `bun run dev` again — it rebuilds the local `dist/` and then starts Docker with a fresh image. API source is live-mounted via Docker volume so `docker compose restart alfira` picks up changes without a rebuild.

### Environment Configuration

A single `.env` file at the project root is used for all configuration. Copy `.env.example` to `.env` and fill in all values before running. Required: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GUILD_ID`, `JWT_SECRET`, `ADMIN_ROLE_IDS`, `DATABASE_URL`, `NODELINK_URL`.

### NodeLink Audio Service

The bot streams audio from NodeLink (a Lavalink v4-compatible server). The `nodelink` service runs in Docker (docker-compose.yml) on port 2333. `hoshimi` (packages/bot) manages players and voice connections. When editing audio-related code, be aware that `stop(true)` on a Hoshimi player destroys the voice session on NodeLink, which can cause the "No voice state, track is enqueued" issue if the next track tries to play before reconnecting.

## Code Style

- Biome for linting and formatting
- Run `bun run check` before committing
- CI runs `bun run lint` — code must pass before merging

## Shared Package Exports

`@alfira-bot/shared` provides:

**Types:** `Song`, `QueuedSong`, `LoopMode`, `QueueState`, `Playlist`, `PlaylistDetail`, `User`

**Utilities:** `formatDuration(seconds)`, `fisherYatesShuffle(array)`

**DB:** Schema defined in `packages/shared/src/db/schema.ts`

**Logger:** `logger` export from `@alfira-bot/shared/logger`

**API Service:** `@alfira-bot/shared/api` provides centralized API functions (`fetchSongs`, `createSong`, `importPlaylist`, etc.) that should be used by all consumers.

## Documentation

- [Installation Guide](docs/installation.md) — Setup, Docker commands, development workflow
- [Configuration Reference](docs/configuration.md) — Environment variables
- [Tech Stack](docs/tech-stack.md) — Detailed architecture
- [Troubleshooting](docs/troubleshooting.md) — Common issues and solutions
