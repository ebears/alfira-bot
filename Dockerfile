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

# Use real Node.js from Alpine apk (bun's node shim resolves .d.ts incorrectly)
RUN apk add --no-cache nodejs npm && \
    rm -f /usr/local/bun-node-fallback-bin/node || true

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
# Production deps stage
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/api/package.json packages/api/package.json
COPY packages/bot/package.json packages/bot/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/web/package.json packages/web/package.json

RUN bun install --production

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

# Copy root package.json and bun.lock for workspace resolution
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/bun.lock ./bun.lock

# Copy package.json files for all packages
COPY --from=builder --chown=nodejs:nodejs /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/bot/package.json ./packages/bot/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json

# Copy built dist folders
COPY --from=builder --chown=nodejs:nodejs /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/bot/dist ./packages/bot/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/web/dist ./packages/web/dist

# Install production dependencies (workspace packages will be symlinked)
RUN bun install --production

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["bun", "run", "packages/api/dist/index.js"]
