# ---------------------------------------------------------------------------
# Build: system deps + bun (used for install/compile stages)
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS build

RUN apk add --no-cache \
    ca-certificates

WORKDIR /app

# ---------------------------------------------------------------------------
# Development stage
# ---------------------------------------------------------------------------
FROM build AS dev
RUN apk add --no-cache git
WORKDIR /usr/local/nodelink
ARG NODELINK_VERSION=v3
RUN git clone --depth 1 --branch ${NODELINK_VERSION} https://github.com/PerformanC/NodeLink.git . && \
    bun install && \
    bun run build
WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY scripts ./scripts

RUN bun install
RUN bun run --filter @alfira-bot/shared build && \
    bun run --filter @alfira-bot/bot build && \
    bun run --filter @alfira-bot/api build && \
    bun run --filter @alfira-bot/web build

# Copy custom NodeLink config into the cloned repo
COPY nodelink-config/config.js /usr/local/nodelink/config.js

ENV NODE_ENV=development

EXPOSE 3001

CMD ["bun", "--env-file=.env", "run", "packages/api/src/index.ts"]

# ---------------------------------------------------------------------------
# Builder stage — builds all packages but does NOT generate a runtime image.
# ---------------------------------------------------------------------------
FROM build AS builder
COPY package.json bun.lock ./
COPY packages ./packages
COPY scripts ./scripts

RUN bun install
# NOTE: NODE_ENV is not set here because bun build produces broken bundles
# with NODE_ENV=production due to how React 19's JSX runtime is bundled.
# NODE_ENV=production is set in the runtime stage instead.
RUN bun run --filter @alfira-bot/shared build && \
    bun run --filter @alfira-bot/bot build && \
    bun run --filter @alfira-bot/api build && \
    bun run --filter @alfira-bot/web build

# ---------------------------------------------------------------------------
# Runtime stage — use bun as the runtime
# ---------------------------------------------------------------------------
FROM oven/bun:1-alpine AS runtime

RUN apk add --no-cache \
    ca-certificates

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy lockfile and package structure (needed for bun install)
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/bun.lock ./bun.lock
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts

# Let Bun install workspace dependencies in the runtime image
RUN bun install --production

# bot and shared are workspace:* deps - copy their built output
COPY --from=builder --chown=nodejs:nodejs /app/packages/bot/dist ./packages/bot/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/web/dist ./packages/web/dist

# Copy built NodeLink into the runtime image
COPY --from=dev /usr/local/nodelink /usr/local/nodelink

# Switch to non-root user
ENV PATH=/usr/local/bin:$PATH
USER nodejs

ENV NODE_ENV=production

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD bun -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["bun", "run", "packages/api/dist/index.js"]
