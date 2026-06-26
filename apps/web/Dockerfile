# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
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
COPY apps/web apps/web
COPY packages/db packages/db
COPY packages/meta-client packages/meta-client
COPY packages/shared packages/shared

RUN <<'EOF'
node <<'NODE'
const fs = require("node:fs");
const configPath = "apps/web/next.config.mjs";
let source = fs.readFileSync(configPath, "utf8");
const needsTracingRoot = !/outputFileTracingRoot\s*:/.test(source);
const entries = [];

if (!/output\s*:/.test(source)) {
  entries.push('  output: "standalone",');
}
if (needsTracingRoot) {
  entries.push('  outputFileTracingRoot: path.join(__dirname, "../.."),');
}
if (entries.length > 0) {
  if (needsTracingRoot && !/fileURLToPath/.test(source)) {
    source = [
      'import path from "node:path";',
      'import { fileURLToPath } from "node:url";',
      'const __dirname = path.dirname(fileURLToPath(import.meta.url));',
      "",
      source
    ].join("\n");
  }
  source = source.replace(/const nextConfig = \{\s*/, (match) => `${match}${entries.join("\n")}\n`);
  fs.writeFileSync(configPath, source);
}
NODE
EOF

RUN mkdir -p apps/web/public && pnpm --filter @adflow/web build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nextjs \
  && useradd --system --uid 1001 --gid nextjs --home-dir /app nextjs \
  && mkdir -p /var/lib/adflow/worker \
  && chmod 1777 /var/lib/adflow/worker

COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nextjs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nextjs /app/db ./db
COPY --from=builder --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
