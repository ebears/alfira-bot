# Contributing to Alfira

Thanks for your interest in contributing! This guide covers the development workflow and contributor-specific info.

For setup instructions, see the **[Installation Guide](docs/installation.md)**.

---

## Development Workflow

The key thing to understand: **Bot + API run in the same process**, and bot code is compiled at image build time.

### What Changed? → What Action?

| What Changed | Action Required |
|--------------|-----------------|
| `packages/web/src/**` | **Nothing** — Vite HMR applies changes automatically |
| `packages/api/src/**` | `docker compose restart api` |
| `packages/bot/src/**` | `docker compose build api && docker compose up -d api` |
| `packages/shared/src/**` | Depends on consumer (see below) |

### Shared Package Changes

The `shared` package is consumed by all other packages:

- **Used by web:** HMR picks up changes automatically
- **Used by api:** Restart required (`docker compose restart api`)
- **Used by bot:** Rebuild required (`docker compose build api`)

---

## Why Bot Changes Require a Rebuild

The bot package is pre-compiled during the Docker image build:

1. `Dockerfile.api` runs `npm run -w packages/bot build`
2. Compiled output is baked into the image at `packages/bot/dist/`
3. API source files are mounted as volumes, but bot's `dist/` stays in the image

This is intentional — it keeps the image lean and avoids needing TypeScript in the runtime container.

---

## Database Migrations

Migrations run automatically on startup via the `migrate` service. See the [Installation Guide](docs/installation.md) for details.

### Manual Migration Commands

```bash
# Run migrations manually
docker compose run --rm migrate

# Reset database (wipe all data)
docker compose down -v
docker compose up --build
```

---

## Slash Commands

Commands must be registered with Discord before they appear in the client.

```bash
# Register commands manually
docker compose exec api npm run bot:deploy
```

Commands are auto-registered on startup by default. Set `AUTO_DEPLOY_COMMANDS=false` to disable. See [Configuration Reference](docs/configuration.md) for details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/installation.md) | Setup, Docker commands, development workflow |
| [Configuration Reference](docs/configuration.md) | Environment variables |
| [Tech Stack](docs/tech-stack.md) | Project structure overview |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |

---

## Questions?

- Check the [Troubleshooting Guide](docs/troubleshooting.md)
- Open an issue on GitHub

Thanks for contributing! 🎵