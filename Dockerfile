# ---------------------------------------------------------------------------
# yt-dlp stage - download and verify yt-dlp (shared between deps and runtime)
# ---------------------------------------------------------------------------
FROM alpine AS ytdlp
ARG YTDLP_VERSION=2026.03.17
RUN apk add --no-cache curl && \
    curl -fL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" \
      -o /yt-dlp && \
    curl -fL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/SHA2-256SUMS" \
      -o /tmp/yt-dlp-sums && \
    grep " yt-dlp$" /tmp/yt-dlp-sums | sed 's| yt-dlp$| /yt-dlp|' | sha256sum -c - && \
    rm /tmp/yt-dlp-sums && \
    chmod a+rx /yt-dlp

# ---------------------------------------------------------------------------
# Build: system deps + bun (used for install/compile stages)
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS build

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    ca-certificates

COPY --from=ytdlp /yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# ---------------------------------------------------------------------------
# Development stage
# ---------------------------------------------------------------------------
FROM build AS dev
COPY package.json bun.lock ./
COPY packages ./packages

RUN bun install
RUN bun run --filter @alfira-bot/shared build && \
    bun run --filter @alfira-bot/bot build && \
    bun run --filter @alfira-bot/api build && \
    bun run --filter @alfira-bot/web build

ENV NODE_ENV=development

EXPOSE 3001

CMD ["bun", "run", "packages/api/src/index.ts"]

# ---------------------------------------------------------------------------
# Builder stage — builds all packages but does NOT generate a runtime image.
# ---------------------------------------------------------------------------
FROM build AS builder
COPY package.json bun.lock ./
COPY packages ./packages

RUN bun install
RUN bun run --filter @alfira-bot/shared build && \
    bun run --filter @alfira-bot/bot build && \
    bun run --filter @alfira-bot/api build && \
    bun run --filter @alfira-bot/web build

# ---------------------------------------------------------------------------
# Runtime stage — use bun as the runtime
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runtime

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    ca-certificates

# Copy yt-dlp from shared stage (no re-download needed)
COPY --from=ytdlp /yt-dlp /usr/local/bin/yt-dlp

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy lockfile and package structure (needed for bun install)
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/bun.lock ./bun.lock
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages

# Let Bun install workspace dependencies in the runtime image
RUN bun install --production

# bot and shared are workspace:* deps - copy their built output
COPY --from=builder --chown=nodejs:nodejs /app/packages/bot/dist ./packages/bot/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "packages/api/dist/index.js"]
