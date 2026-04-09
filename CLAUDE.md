# CLAUDE.md

Guidance for Claude Code when working with this codebase.

## Project Overview

Alfira is a self-hosted Discord music bot with a web UI as the primary interface. It's a Bun workspaces monorepo with four packages:

- `packages/shared` — Shared types and utilities (formatDuration, fisherYatesShuffle)
- `packages/bot` — Discord bot (GuildPlayer, yt-dlp wrapper)
- `packages/api` — Bun API, Drizzle ORM
- `packages/web` — React + Tailwind web UI

The bot and API run in a **single Bun process**, sharing memory for player state. This allows real-time updates to be broadcast directly from playback events.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Discord:** discord.js v14, @discordjs/voice
- **Audio:** yt-dlp + ffmpeg
- **API:** Bun HTTP
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Frontend:** React 19 + Tailwind CSS 4
- **Linting:** Biome

## Development Commands

```bash
# Start the API + bot (Docker)
bun run dev

# Start the web dev server for the UI
bun run web:dev

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

### Bot Changes Require Rebuild

The bot package is pre-compiled during Docker image build:

1. `Dockerfile` runs `bun run --filter @alfira-bot/bot build`
2. Compiled output is baked into the image at `packages/bot/dist/`
3. API source files are mounted as volumes, but bot's `dist/` stays in the image

**If you change `packages/bot/src/**`:** Rebuild required (`docker compose build api && docker compose up -d api`)

### Shared Package Changes

- **Used by web:** HMR picks up changes automatically
- **Used by api:** Restart required (`docker compose restart api`)
- **Used by bot:** Rebuild required

## Code Style

- Biome for linting and formatting
- Run `bun run check` before committing
- CI runs `bun run lint` — code must pass before merging

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
