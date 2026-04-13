# Contributing to Alfira

Thanks for your interest in contributing! This guide covers the development workflow and contributor-specific info.

For setup instructions, see the **[Installation Guide](docs/installation.md)**.

---

## Development Workflow

The key thing to understand: **Bot + API run in the same process** (merged into `packages/server`), and server code is compiled at image build time.

### What Changed? → What Action?

| What Changed | Action Required |
|--------------|-----------------|
| `packages/web/src/**` | **Nothing** — Bun serve with live reload applies changes automatically |
| `packages/server/src/**` | `docker compose restart alfira` |
| `packages/shared/src/**` | Rebuild required (`docker compose build`) |

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

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](docs/installation.md) | Setup, Docker commands, development workflow |
| [Configuration Reference](docs/configuration.md) | Environment variables |
| [Tech Stack](docs/tech-stack.md) | Project structure overview |
| [Troubleshooting](docs/troubleshooting.md) | Common issues and solutions |
| [Biome Setup](docs/biome-setup.md) | Linting and formatting configuration |

---

## Code Quality

The project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Lint + format check with auto-fix (recommended before committing)
bun run check

# Lint only, with auto-fix
bun run lint:fix

# Format only, with auto-fix
bun run format
```

CI runs `bun run lint` in the typecheck workflow — your code must pass before merging. See the [Biome Setup](docs/biome-setup.md) doc for configuration details.

---

## Questions?

- Check the [Troubleshooting Guide](docs/troubleshooting.md)
- Open an issue on GitHub

Thanks for contributing! 🎵
