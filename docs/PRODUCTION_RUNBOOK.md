# Production Runbook

Current deployment host: `89.208.252.84`
Current deployment URL: `http://89.208.252.84`
Deployment directory: `/opt/adflow`

## Safety Rules

- Do not commit `.env.production`.
- Do not print secrets from `.env.production`.
- Do not run `docker system prune -a` on the host.
- Do not modify unrelated services on the server.
- Do not enable real Meta writes until Meta credentials, test ad account IDs, and allowlist approval are complete.
- Keep `COMPOSE_PARALLEL_LIMIT=1` for on-host image builds on this 1 GiB RAM server.

## Status

```bash
cd /opt/adflow
docker compose -f docker-compose.prod.yml --env-file .env.production ps
```

Expected services:

- `postgres`
- `redis`
- `web`
- `worker`
- `reverse-proxy`

## Health Checks

```bash
cd /opt/adflow
curl -fsS http://127.0.0.1/api/health/live
curl -fsS http://127.0.0.1/api/health || true
bash deploy/healthcheck.sh
```

`/api/health` should report JSON `status: ok` when PostgreSQL, Redis, worker heartbeat, demo/live mode, and write gates are healthy. The worker heartbeat is shared through the `worker-heartbeat` Docker volume.

## Logs

```bash
cd /opt/adflow
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f web
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f worker
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f reverse-proxy
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f postgres
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f redis
```

## Restart

```bash
cd /opt/adflow
docker compose -f docker-compose.prod.yml --env-file .env.production up -d web worker reverse-proxy
```

## Deploy Current Branch

```bash
cd /opt/adflow
git fetch origin codex/production-meta-ads
git checkout codex/production-meta-ads
git reset --hard <approved-commit>
COMPOSE_PARALLEL_LIMIT=1 docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env.production up -d web worker reverse-proxy
bash deploy/healthcheck.sh
```

## Backup

```bash
cd /opt/adflow
bash deploy/backup.sh
```

Backups are written under `/opt/adflow/backups/`. Move long-term backups to encrypted external storage.

## Restore

Restore is destructive and replaces the PostgreSQL `public` schema. Do not run it without explicit approval.

```bash
cd /opt/adflow
CONFIRM_RESTORE=I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA bash deploy/restore.sh backups/fbkp-postgres-YYYYMMDDTHHMMSSZ.sql.gz
bash deploy/healthcheck.sh
```

## Rollback

Use rollback only for image/runtime regressions. For bad data migrations, decide between fix-forward and restore first.

```bash
cd /opt/adflow
bash deploy/rollback.sh
```

## Network Expectations

- Public port 80 is exposed by `reverse-proxy`.
- Public ports 3000, 5432, and 6379 must remain closed.
- PostgreSQL and Redis are only reachable inside Docker networks.
- Worker exposes no public port.

## External Inputs Required

- Domain name and DNS record pointing to `89.208.252.84`.
- Meta App ID and Secret.
- Meta OAuth redirect URI for the final domain.
- Test Meta ad account ID.
- Approved `ALLOWED_META_AD_ACCOUNT_IDS`.
- Real Meta test account acceptance before any write mode is enabled.
