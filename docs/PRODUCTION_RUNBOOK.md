# Production Runbook

## Normal Deploy

1. Confirm no other deployment is running.
2. Confirm `.env.production` exists on the server and is not committed.
3. Run `deploy/deploy.sh`.
4. Run `deploy/healthcheck.sh` if a second check is needed.
5. Review service status with `docker compose --env-file .env.production -f docker-compose.prod.yml ps`.

Do not run `docker compose config` in shared logs because it expands environment values.

## Routine Health Checks

```bash
deploy/healthcheck.sh
```

Expected checks:

- all five containers are running;
- PostgreSQL accepts `pg_isready`;
- Redis responds to authenticated `PING`;
- Caddy serves the configured local health URL.

## Backup

Run before risky deploys or maintenance:

```bash
deploy/backup.sh
```

Backups are written to `backups/` with mode `600`. Move long-term backups to encrypted storage outside the application host.

## Restore

Restore replaces the PostgreSQL `public` schema. Stop and confirm user-facing maintenance before running:

```bash
CONFIRM_RESTORE=I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA deploy/restore.sh backups/fbkp-postgres-YYYYMMDDTHHMMSSZ.sql.gz
```

After restore, run `deploy/healthcheck.sh` and verify the app through the browser.

## Rollback

Use rollback only for image/runtime regressions:

```bash
deploy/rollback.sh
```

For data migrations or destructive app changes, decide between fix-forward and database restore before changing containers.

## Secret Handling

- Never echo `.env.production`.
- Never paste real `DATABASE_URL`, `REDIS_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `TOKEN_ENCRYPTION_KEY_BASE64`, or Meta secrets into logs.
- Prefer one deployment process at a time; scripts use `.deploy-state/deploy.lock`.
- Keep `.env.production` mode `600`.

## Network Expectations

- Only Caddy publishes host port `80`.
- PostgreSQL and Redis have no host port mapping.
- `backend` is an internal Docker network.
- Worker has an egress-only network attachment for future Meta API calls without exposing ports.

## Known Gaps Outside This Infra Scope

- App health routes are expected at `/api/health/live` and `/api/health/ready`; the default deployment health check uses liveness.
- Worker readiness is checked through the worker package heartbeat. Queue processor behavior is owned by the worker module.
- HTTPS automation is not configured here because the requested Caddy scope is port `80` reverse proxy only.
