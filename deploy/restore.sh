#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib.sh
source "${SCRIPT_DIR}/lib.sh"

need_cmd docker
need_cmd gzip
docker_compose_available || die "Docker Compose v2 plugin is required"
require_compose_files
check_env_file

backup_file="${1:-}"
[[ -n "$backup_file" ]] || die "Usage: CONFIRM_RESTORE=I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA deploy/restore.sh <backup.sql.gz>"
[[ -f "$backup_file" ]] || die "Backup file not found: $backup_file"
[[ "$backup_file" == *.sql.gz ]] || die "Restore expects a .sql.gz file created by deploy/backup.sh"

if [[ "${CONFIRM_RESTORE:-}" != "I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA" ]]; then
  die "Refusing destructive restore without CONFIRM_RESTORE=I_UNDERSTAND_THIS_REPLACES_PRODUCTION_DATA"
fi

acquire_deploy_lock

log "Stopping web and worker before database restore."
compose stop web worker

log "Replacing PostgreSQL public schema."
compose exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -c "DROP SCHEMA IF EXISTS public CASCADE;" \
    -c "CREATE SCHEMA public;" \
    -c "GRANT ALL ON SCHEMA public TO \"$POSTGRES_USER\";" \
    -c "GRANT ALL ON SCHEMA public TO public;"
'

log "Restoring PostgreSQL backup."
gzip -dc "$backup_file" | compose exec -T postgres sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

log "Starting application services after restore."
compose up -d web worker reverse-proxy

log "Running health checks after restore."
"${SCRIPT_DIR}/healthcheck.sh"

log "Restore completed."
