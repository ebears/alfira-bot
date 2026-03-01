# Tech Stack

## Overview

| Component | Technology |
|-----------|------------|
| **Runtime** | Node.js 24 (LTS) |
| **Language** | TypeScript |
| **Discord** | `discord.js` v14, `@discordjs/voice`, `@snazzah/davey` |
| **Audio** | `yt-dlp`, `ffmpeg` |
| **API** | Express.js |
| **Real-time** | Socket.io |
| **Database** | PostgreSQL + Prisma |
| **Frontend** | React (Vite) + Tailwind CSS |

## Project Structure

The project is an npm workspaces monorepo:

```
packages/
├── shared    # Shared TypeScript types (Song, QueueState, Playlist, etc.)
├── bot       # Discord bot (slash commands, GuildPlayer, yt-dlp wrapper)
├── api       # Express API, Prisma, Socket.io server
└── web       # Vite + React + Tailwind web UI
```

## Development Scripts

Top-level scripts:

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the API + bot |
| `npm run web:dev` | Start the Vite dev server for the web UI |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
