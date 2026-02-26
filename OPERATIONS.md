Operations & Deployment
=======================

This document covers operational tasks for running `alfira-bot` in production, with a focus on
database migrations and the containerised stack.

## Database migrations

The project uses Prisma migrations stored in `packages/api/prisma/migrations`. These need to be
applied to your production PostgreSQL database whenever the schema changes.

### Scripts

In `packages/api/package.json`:

- `db:migrate` – `prisma migrate dev` (development only).
- `db:migrate:deploy` – `prisma migrate deploy` (production-safe).

Use `db:migrate` locally while developing (it can create new migrations). Use
`db:migrate:deploy` in production to apply already-checked-in migrations.

### Running migrations in production

There are two main ways to run migrations against your production DB.

#### 1. One-off docker run (CI or manual)

If your production database is reachable from where you run Docker, you can apply migrations
with a one-off container based on the API image:

```bash
docker run --rm \
  -e DATABASE_URL=postgresql://botuser:botpass@db:5432/musicbot \
  ghcr.io/ebears/alfira-bot-api:latest \
  npm run -w packages/api db:migrate:deploy
```

This is ideal for CI/CD pipelines where you want an explicit "run migrations" step before
bringing the app containers up.

#### 2. `migrate` service via docker-compose.prod.yml

The production compose file includes a `migrate` service:

```yaml
migrate:
  image: ghcr.io/ebears/alfira-bot-api:latest
  depends_on:
    db:
      condition: service_healthy
  restart: "no"
  environment:
    NODE_ENV: production
    DATABASE_URL: postgresql://botuser:botpass@db:5432/musicbot
  command: ["npm", "run", "-w", "packages/api", "db:migrate:deploy"]
```

To run migrations with this service:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate
```

This will:

- Wait for the `db` service to be healthy.
- Run `prisma migrate deploy` against that database.
- Exit without leaving a long-running container.

You can call this command manually before `docker compose up`, or integrate it into your
deployment tooling.

### Recommended production workflow

When deploying a new version that includes database changes:

1. **Build and publish images** (via GitHub Actions or your build pipeline).
2. **Update your server** to pull the new images:

   ```bash
   docker compose -f docker-compose.prod.yml pull
   ```

3. **Apply migrations**:

   ```bash
   docker compose -f docker-compose.prod.yml run --rm migrate
   ```

4. **Start or restart the app stack**:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

This keeps schema changes explicit and avoids surprising migration behaviour on container
startup.

