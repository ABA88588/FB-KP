# Self-hosted Production Deployment

This deployment bundle is intentionally limited to server and production deployment files. It does not change application features, routes, database schema, or screenshots.

## Topology

- `reverse-proxy`: Caddy listening on host port `80`, proxying to `web:3000`.
- `web`: Next.js standalone runtime, non-root user, attached to the proxy and backend networks.
- `worker`: non-root runtime for the `@adflow/worker` package.
- `postgres`: private backend network only, no public host port.
- `redis`: private backend network only, no public host port.

`backend` is an internal Docker network. `postgres` and `redis` are not attached to any public network.

## First Server Bootstrap

From the repository root on the server:

```bash
deploy/bootstrap-server.sh
```

This creates:

- `.env.production` from `.env.production.example` if missing.
- `.deploy-state/` for deployment state and lock files.
- `backups/` for database backups.

Then edit `.env.production` on the server. Use generated values for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `TOKEN_ENCRYPTION_KEY_BASE64`. Do not paste those values into tickets, logs, shell history, or docs.

## Required Runtime

- Docker Engine with Compose v2 plugin.
- Linux host with port `80` available.
- Outbound network access for image pulls and, once live mode is configured, Meta API calls.
- A real DNS name should point to the host before production OAuth is enabled.

## Deploy

```bash
deploy/deploy.sh
```

The script:

1. Validates required env keys without printing secret values.
2. Validates Compose syntax without printing expanded config.
3. Pulls base service images.
4. Builds `web` and `worker`.
5. Starts `postgres`, `redis`, `web`, `worker`, and `reverse-proxy`.
6. Runs `deploy/healthcheck.sh`.

It does not run aggressive Docker prune commands.

## Health Check

```bash
deploy/healthcheck.sh
```

Default HTTP target is `HEALTHCHECK_URL` from `.env.production`, falling back to `http://127.0.0.1/`. The production example uses `/api/health/live`; use `/api/health/ready` when deployment health should include dependency readiness.

## Backup And Restore

Create a PostgreSQL backup:

```bash
deploy/backup.sh
```

Restore is destructive and requires an explicit confirmation environment variable:

```bash
CONFIRM_RESTORE=I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA deploy/restore.sh backups/fbkp-postgres-YYYYMMDDTHHMMSSZ.sql.gz
```

Redis is treated as cache/queue state in this bundle. The authoritative backup is PostgreSQL.

## Rollback

If `IMAGE_TAG` tracks immutable image tags, rollback to the previous recorded tag:

```bash
deploy/rollback.sh
```

Or provide a tag explicitly:

```bash
deploy/rollback.sh 2026-06-26T120000Z
```

Database rollback is not automated. Use restore only after confirming the data impact.

## Current Application Constraints

- `apps/worker/Dockerfile` builds and runs the current `@adflow/worker` package without changing worker source code. Worker queue behavior remains owned by the worker module.
- `apps/web/Dockerfile` builds a standalone runtime and keeps a container-build-only fallback that injects standalone output if the app config stops declaring it.
