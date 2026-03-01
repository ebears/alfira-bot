# Installation Guide

This guide covers everything you need to set up Alfira for both development and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Discord Application Setup](#discord-application-setup)
- [Configuration](#configuration)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)
- [Upgrading](#upgrading)

---

## Prerequisites

### For Development

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 20.10+ | With Docker Compose plugin |
| Git | Any | For cloning the repository |

No local Node.js, ffmpeg, or yt-dlp installation needed — Docker handles everything.

### For Production

| Requirement | Version | Notes |
|-------------|---------|-------|
| Docker | 20.10+ | With Docker Compose plugin |
| Reverse Proxy | Any | Caddy (recommended), Nginx, Traefik, etc. |
| Domain (optional) | — | For HTTPS/TLS termination |

---

## Discord Application Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **"New Application"**.
3. Give it a name (e.g., "Alfira") and click **Create**.
4. Note your **Application ID** — this is your `DISCORD_CLIENT_ID`.

### 2. Create a Bot User

1. Navigate to **Bot** in the left sidebar.
2. Click **"Add Bot"**, then confirm.
3. Click **"Reset Token"** to generate a bot token.
4. Copy the token — this is your `DISCORD_BOT_TOKEN`. You won't be able to see it again!
5. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent**
   - **Server Members Intent** (optional, for role-based features)
6. Click **"Save Changes"**.

### 3. Configure OAuth2

1. Navigate to **OAuth2** → **General**.
2. Copy the **Client secret** — this is your `DISCORD_CLIENT_SECRET`.
3. Add your redirect URL:
   - Development: `http://localhost:3001/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
4. Click **"Save Changes"**.

### 4. Invite the Bot to Your Server

1. Navigate to **OAuth2** → **URL Generator**.
2. Under **Scopes**, check:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions**, check:
   - `Connect`
   - `Speak`
   - `Use Voice Activity`
   - `View Channels`
   - `Send Messages`
   - `Embed Links`
   - `Use Slash Commands`
4. Copy the generated URL at the bottom, open it in your browser, and authorize the bot for your server.

### 5. Get Your Guild and Role IDs

1. Enable **Developer Mode** in Discord: Settings → Advanced → Developer Mode.
2. Right-click your server icon and select **"Copy Server ID"** — this is your `GUILD_ID`.
3. Right-click the admin role and select **"Copy Role ID"** — this is your `ADMIN_ROLE_ID`.

---

## Configuration

Alfira uses environment variables for configuration. Copy the example files and fill in your values:

```bash
cp packages/api/.env.example packages/api/.env
cp packages/bot/.env.example packages/bot/.env
```

### Environment Variables Reference

#### Required (API)

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_CLIENT_ID` | Discord application client ID | `123456789012345678` |
| `DISCORD_CLIENT_SECRET` | Discord application client secret | `abc123...` |
| `DISCORD_BOT_TOKEN` | Discord bot token | `MTAwMC4...` |
| `GUILD_ID` | Discord server ID | `987654321098765432` |
| `JWT_SECRET` | Secret for signing JWT tokens | `your-secure-random-string` |
| `ADMIN_ROLE_ID` | Discord role ID for admin permissions | `123456789012345678` |

#### Required (Bot)

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot token (same as API) | `MTAwMC4...` |
| `DISCORD_CLIENT_ID` | Discord application client ID (same as API) | `123456789012345678` |

#### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Set by Docker Compose |
| `WEB_UI_ORIGIN` | Public URL of the web UI | `http://localhost:5173` |
| `DISCORD_REDIRECT_URI` | OAuth2 redirect URI | `http://localhost:3001/auth/callback` |
| `PORT` | API server port | `3001` |

> **Note:** `DATABASE_URL` is set automatically by Docker Compose in development. You typically don't need to set it manually.

For a complete configuration reference, see the **[Configuration Guide](configuration.md)**.

---

## Development Setup

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/ebears/alfira-bot.git
cd alfira-bot

# 2. Configure environment variables
cp packages/api/.env.example packages/api/.env
cp packages/bot/.env.example packages/bot/.env
# Edit both .env files with your values

# 3. Build and start all services
docker compose up --build
```

This starts:

| Service | URL | Description |
|---------|-----|-------------|
| `db` | `localhost:5432` | PostgreSQL 16 |
| `api` | `localhost:3001` | Express API + Socket.io + Discord bot |
| `web` | `localhost:5173` | Vite dev server with HMR |

### Development Workflow

| What Changed | Action |
|--------------|--------|
| `packages/web/src/**` | Nothing — Vite HMR applies changes automatically |
| `packages/api/src/**` | `docker compose restart api` |
| `packages/bot/src/**` | `docker compose build api && docker compose up -d api` |

### Useful Commands

```bash
# Start services in detached mode
docker compose up -d

# View logs
docker compose logs -f api

# Stop all services
docker compose down

# Stop and remove volumes (fresh database)
docker compose down -v

# Restart a specific service
docker compose restart api

# Rebuild a specific service
docker compose build api
docker compose up -d api
```

---

## Production Setup

Alfira uses pre-built Docker images from GitHub Container Registry (GHCR), making deployment simple.

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/ebears/alfira-bot.git
cd alfira-bot

# 2. Create your environment file
cp .env.example .env

# 3. Edit .env with your values
#    - Discord credentials (from Developer Portal)
#    - Your Guild ID and Admin Role ID
#    - A secure JWT_SECRET (generate with: openssl rand -hex 32)
#    - Your domain for WEB_UI_ORIGIN and DISCORD_REDIRECT_URI

# 4. Start all services
docker compose -f docker-compose.prod.yml up -d
```

That's it! The stack will pull the pre-built images and start:

| Service | Description |
|---------|-------------|
| `db` | PostgreSQL 16 with healthcheck |
| `migrate` | Runs database migrations on startup |
| `api` | API + Discord bot from GHCR image |
| `web` | Static web UI served by nginx on port 80 |

### Environment Variables

All configuration is handled through a single `.env` file in the project root. Copy `.env.example` and fill in your values:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_CLIENT_ID` | ✅ | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | ✅ | Discord application client secret |
| `DISCORD_BOT_TOKEN` | ✅ | Discord bot token |
| `GUILD_ID` | ✅ | Your Discord server ID |
| `ADMIN_ROLE_IDS` | ✅ | Admin role ID(s), comma-separated |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `POSTGRES_USER` | ✅ | Database username |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `POSTGRES_DB` | ✅ | Database name |
| `WEB_UI_ORIGIN` | ⚪ | Public URL of the web UI |
| `DISCORD_REDIRECT_URI` | ⚪ | OAuth2 callback URL |

> **Security:** Use a strong, random `JWT_SECRET`. Generate one with: `openssl rand -hex 32`

### Reverse Proxy (Optional)

For production with a custom domain, use a reverse proxy like **Caddy** or **Nginx** for HTTPS.

#### Caddy (Recommended)

Create a `Caddyfile`:

```Caddy
your-domain.com {
    reverse_proxy /api* api:3001
    reverse_proxy /auth* api:3001
    reverse_proxy /socket.io* api:3001
    reverse_proxy /* web:80
}
```

Then run both stacks:

```bash
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.caddy.yml up -d
```

For internal-only access, you can remove the port mappings from `docker-compose.prod.yml` so only your reverse proxy exposes ports.

---

## Upgrading

Pull the latest images and restart:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Database migrations run automatically on startup. If you encounter issues:

```bash
docker compose -f docker-compose.prod.yml logs -f migrate
```

---

## Next Steps

After installation:

1. Visit your web UI and log in with Discord.
2. Add songs to your library using YouTube URLs.
3. Create playlists and start playing music!

For more information, see:

- **[Configuration Guide](configuration.md)** — Complete environment variables reference
- **[Troubleshooting](troubleshooting.md)** — Common issues and solutions
