# Configuration Reference

This document provides a complete reference for all environment variables used by Alfira.

## Environment Files

Alfira uses two environment files:

| File | Purpose |
|------|---------|
| `packages/api/.env` | API server, database, OAuth2, and web UI configuration |
| `packages/bot/.env` | Discord bot configuration |

Copy the example files to get started:

```bash
cp packages/api/.env.example packages/api/.env
cp packages/bot/.env.example packages/bot/.env
```

---

## API Configuration (`packages/api/.env`)

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_CLIENT_ID` | Discord application client ID (from Developer Portal) | `123456789012345678` |
| `DISCORD_CLIENT_SECRET` | Discord application client secret | `abc123def456...` |
| `DISCORD_BOT_TOKEN` | Discord bot token | `MTAwMC4xMjM0NTY3ODkw...` |
| `GUILD_ID` | Discord server ID where the bot operates | `987654321098765432` |
| `ADMIN_ROLE_IDS` | Discord role ID(s) for admin users (comma-separated) | `123456789012345678` |
| `JWT_SECRET` | Secret key for signing JWT tokens | `your-secure-random-string` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Set by Docker Compose |
| `PORT` | API server port | `3001` |
| `WEB_UI_ORIGIN` | Public URL of the web UI (for CORS and redirects) | `http://localhost:8180` |
| `DISCORD_REDIRECT_URI` | OAuth2 callback URL | `http://localhost:8180/auth/callback` |
| `JWT_EXPIRES_IN` | JWT refresh token expiry duration (supports `d`, `h`, `m`, `s` suffixes) | `7d` |
| `DEFAULT_TEXT_CHANNEL_ID` | Text channel for "Now playing" embeds when auto-joining via web UI | Guild's system channel |
| `TRUSTED_PROXY_IP` | IP address of reverse proxy (for rate limiting and `X-Forwarded-For` trust) | — |
| `DOCKER_HOST_IP` | IP to bind the API port to (e.g., LAN interface) | `0.0.0.0` |

### Production-Specific

| Variable | Description | Example |
|----------|-------------|---------|
| `WEB_UI_ORIGIN` | Public domain of the web UI | `https://alfira.example.com` |
| `DISCORD_REDIRECT_URI` | OAuth2 callback URL (must match Discord Developer Portal) | `https://alfira.example.com/auth/callback` |

---

## Bot Configuration (`packages/bot/.env`)

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Discord bot token (same as API) | `MTAwMC4xMjM0NTY3ODkw...` |
| `DISCORD_CLIENT_ID` | Discord application client ID (same as API) | `123456789012345678` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
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

For production, you can either:

1. **Let Docker Compose handle it** (recommended) — Docker Compose constructs `DATABASE_URL` automatically from the `POSTGRES_*` variables
2. **Use an external database** — set `DATABASE_URL` to your external PostgreSQL instance

When using Docker Compose, set these variables in your root `.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_USER` | Database username | `alfira` |
| `POSTGRES_PASSWORD` | Database password | `change-this-to-a-secure-password` |
| `POSTGRES_DB` | Database name | `alfira` |

Example for external database:

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

`packages/api/.env`:

```env
DISCORD_CLIENT_ID=123456789012345678
DISCORD_CLIENT_SECRET=your-client-secret
DISCORD_BOT_TOKEN=your-bot-token
GUILD_ID=987654321098765432
ADMIN_ROLE_IDS=123456789012345678
JWT_SECRET=dev-secret-change-in-production
# DATABASE_URL is set by Docker Compose
```

`packages/bot/.env`:

```env
DISCORD_BOT_TOKEN=your-bot-token
DISCORD_CLIENT_ID=123456789012345678
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
