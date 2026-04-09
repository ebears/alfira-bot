# CLAUDE.md

Guidance for Claude Code when working with this codebase.

## Project Overview

Alfira is a self-hosted Discord music bot with a web UI as the primary interface. It's a Bun workspaces monorepo with four packages:

- `packages/shared` — Shared types and utilities (formatDuration, fisherYatesShuffle)
- `packages/bot` — Discord bot (GuildPlayer, yt-dlp wrapper)
- `packages/api` — Bun API, Drizzle ORM
- `packages/web` — React + Tailwind web UI

The bot and API run in a **single Bun process**, sharing memory for player state. This allows real-time updates to be broadcast directly from playback events via Bun's native WebSocket.

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Discord:** discord.js v14, @discordjs/voice
- **Audio:** yt-dlp + ffmpeg
- **API:** Bun native HTTP + WebSocket
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Frontend:** React 19 + Tailwind CSS 4 (built with Bun)
- **Linting:** Biome

## Development Commands

```bash
# Build shared + bot locally (for editor LSP), then start everything with Docker
bun run dev

# Build the web UI (used by Docker)
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

### Bot Changes Require Rebuild

The bot package is pre-compiled during Docker image build. If you change `packages/bot/src/**`, run `bun run dev` again — it rebuilds the local `dist/` and then starts Docker with a fresh image.

### Environment Configuration

A single `.env` file at the project root is used for all configuration. Copy `.env.example` to `.env` and fill in all values before running the application.

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
