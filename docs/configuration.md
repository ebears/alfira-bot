# Configuration Reference

This document provides a complete reference for all environment variables used by Alfira.

## Environment File

Alfira uses a single environment file at the project root: `.env`.

Copy the example file to get started:

```bash
cp .env.example .env
```

---

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_CLIENT_ID` | Discord application client ID (from Developer Portal) | `123456789012345678` |
| `DISCORD_CLIENT_SECRET` | Discord application client secret | `abc123def456...` |
| `DISCORD_BOT_TOKEN` | Discord bot token | `MTAwMC4xMjM0NTY3ODkw...` |
| `GUILD_ID` | Discord server ID where the bot operates | `987654321098765432` |
| `ADMIN_ROLE_IDS` | Discord role ID(s) for admin users (comma-separated) | `123456789012345678` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-secure-random-string` |

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `alfira` |
| `POSTGRES_PASSWORD` | Database password | `change-this-to-a-secure-password` |
| `POSTGRES_DB` | Database name | `alfira` |

---

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3001` |
| `WEB_UI_ORIGIN` | Public URL of the web UI (for CORS and redirects) | `http://localhost:3001` |
| `DISCORD_REDIRECT_URI` | OAuth2 callback URL | `http://localhost:3001/auth/callback` |
| `JWT_EXPIRES_IN` | JWT refresh token expiry duration (supports `d`, `h`, `m`, `s` suffixes) | `7d` |
| `DEFAULT_TEXT_CHANNEL_ID` | Text channel for "Now playing" embeds when auto-joining via web UI | Guild's system channel |
| `NODELINK_URL` | NodeLink server URL | `http://localhost:2333` (dev) or `http://nodelink:3000` (Docker) |
| `NODELINK_AUTHORIZATION` | NodeLink password | (empty by default) |
| `VOICE_IDLE_TIMEOUT_MINUTES` | Minutes before bot leaves voice channel when idle | `5` |
| `TRUSTED_PROXY_IP` | IP address of reverse proxy (for rate limiting and `X-Forwarded-For` trust) | — |
| `DOCKER_HOST_IP` | IP to bind the API port to (e.g., LAN interface) | `0.0.0.0` |

### Production-Specific

| Variable | Description | Example |
|----------|-------------|---------|
| `WEB_UI_ORIGIN` | Public domain of the web UI | `https://alfira.example.com` |
| `DISCORD_REDIRECT_URI` | OAuth2 callback URL (must match Discord Developer Portal) | `https://alfira.example.com/auth/callback` |

---

## Database Configuration

The `DATABASE_URL` follows the PostgreSQL connection string format:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### Development

In development, Docker Compose sets this automatically. The default is:

```
DATABASE_URL=postgresql://botuser:botpass@db:5432/musicbot
```

### Production

Docker Compose constructs `DATABASE_URL` automatically from the `POSTGRES_*` variables. For an external database, set `DATABASE_URL` directly:

```env
DATABASE_URL=postgresql://alfira_user:secure_password@db.example.com:5432/alfira
```

---

## Generating Secrets

### JWT_SECRET

Generate a secure random string:

```bash
# Using openssl
openssl rand -hex 32

# Using Bun
bun -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

### Discord Tokens

Discord tokens are generated in the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Client ID** — Found under "General Information"
2. **Client Secret** — Found under "OAuth2" → "General" (click "Reset Secret")
3. **Bot Token** — Found under "Bot" (click "Reset Token")

---

## Example Configurations

### Development

`.env` (project root):

```env
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_BOT_TOKEN=your-bot-token
GUILD_ID=987654321098765432
ADMIN_ROLE_IDS=123456789012345678
JWT_SECRET=dev-secret-change-in-production
POSTGRES_USER=alfira
POSTGRES_PASSWORD=change-this-to-a-secure-password
POSTGRES_DB=alfira
# DATABASE_URL is set by Docker Compose
```

### Production

`.env` (project root):

```env
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_BOT_TOKEN=your-bot-token
GUILD_ID=987654321098765432
ADMIN_ROLE_IDS=123456789012345678
JWT_SECRET=a1b2c3d4e5f6...your-secure-64-char-hex-string
POSTGRES_USER=alfira
POSTGRES_PASSWORD=change-this-to-a-secure-password
POSTGRES_DB=alfira
WEB_UI_ORIGIN=https://alfira.example.com
DISCORD_REDIRECT_URI=https://alfira.example.com/auth/callback
```

---

## See Also

- [Installation Guide](installation.md) — Setting up Alfira
- [Troubleshooting](troubleshooting.md) — Common issues and solutions
