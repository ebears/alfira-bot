# CLAUDE.md

Guidance for Claude Code when working with this codebase.

## Project Overview

Alfira is a self-hosted Discord music bot with a web UI as the primary interface. It's a pnpm workspaces monorepo with four packages:

- `packages/shared` — Shared types and utilities (formatDuration, fisherYatesShuffle)
- `packages/bot` — Discord bot (slash commands, GuildPlayer, yt-dlp wrapper)
- `packages/api` — Express API, Prisma, Socket.io server
- `packages/web` — Vite + React + Tailwind web UI

The bot and API run in a **single Node.js process**, sharing memory for player state. This allows Socket.io to broadcast real-time updates directly from playback events.

## Tech Stack

- **Runtime:** Node.js 24
- **Language:** TypeScript
- **Discord:** discord.js v14, @discordjs/voice
- **Audio:** yt-dlp + ffmpeg
- **API:** Express.js 5
- **Real-time:** Socket.io
- **Database:** PostgreSQL 16 + Prisma 7
- **Frontend:** React 19 + Vite 8 + Tailwind CSS 4
- **Linting:** Biome

## Development Commands

```bash
# Start the API + bot (Docker)
pnpm run dev

# Start the Vite dev server for web UI
pnpm run web:dev

# Generate Prisma client
pnpm run db:generate

# Run Prisma migrations
pnpm run db:migrate

# Lint + format with auto-fix (run before committing)
pnpm run check

# Lint only, with auto-fix
pnpm run lint:fix

# Format only, with auto-fix
pnpm run format
```

## Key Architecture Notes

### Bot Changes Require Rebuild

The bot package is pre-compiled during Docker image build:

1. `Dockerfile.api` runs `npm run -w packages/bot build`
2. Compiled output is baked into the image at `packages/bot/dist/`
3. API source files are mounted as volumes, but bot's `dist/` stays in the image

**If you change `packages/bot/src/**`:** Rebuild required (`docker compose build api && docker compose up -d api`)

### Shared Package Changes

- **Used by web:** HMR picks up changes automatically
- **Used by api:** Restart required (`docker compose restart api`)
- **Used by bot:** Rebuild required

### Slash Commands

Commands must be registered with Discord:

```bash
docker compose exec api pnpm run bot:deploy
```

Commands are auto-registered on startup by default (configurable via `AUTO_DEPLOY_COMMANDS`).

## Code Style

- Biome for linting and formatting
- Run `pnpm run check` before committing
- CI runs `pnpm run lint` — code must pass before merging

## Shared Package Exports

`@alfira-bot/shared` provides:

**Types:** `Song`, `QueuedSong`, `LoopMode`, `QueueState`, `Playlist`, `PlaylistDetail`, `User`

**Utilities:** `formatDuration(seconds)`, `fisherYatesShuffle(array)`

**API Service:** `@alfira-bot/shared/api` provides centralized API functions (`fetchSongs`, `createSong`, `importPlaylist`, etc.) that should be used by all consumers.

## Documentation

- [Installation Guide](docs/installation.md) — Setup, Docker commands, development workflow
- [Configuration Reference](docs/configuration.md) — Environment variables
- [Tech Stack](docs/tech-stack.md) — Detailed architecture
- [Troubleshooting](docs/troubleshooting.md) — Common issues and solutions
