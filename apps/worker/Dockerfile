# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json prisma.config.ts ./
COPY db db
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/meta-client/package.json packages/meta-client/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
WORKDIR /app
COPY apps/worker apps/worker
COPY packages/db packages/db
COPY packages/meta-client packages/meta-client
COPY packages/shared packages/shared
RUN pnpm --filter @adflow/worker build
RUN pnpm prune --prod

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV WORKER_HEARTBEAT_PATH=/tmp/fbkp-worker-heartbeat.json

RUN groupadd --system --gid 1002 worker \
  && useradd --system --uid 1002 --gid worker --home-dir /app worker \
  && chown worker:worker /app

COPY --from=builder --chown=worker:worker /app/node_modules ./node_modules
COPY --from=builder --chown=worker:worker /app/packages/db ./packages/db
COPY --from=builder --chown=worker:worker /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder --chown=worker:worker /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder --chown=worker:worker /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=worker:worker /app/db ./db
COPY --from=builder --chown=worker:worker /app/prisma.config.ts ./prisma.config.ts

USER worker

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node apps/worker/dist/health/read-heartbeat.js

CMD ["node", "--enable-source-maps", "apps/worker/dist/index.js"]
