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

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_file="${BACKUP_DIR}/fbkp-postgres-${timestamp}.sql.gz"

log "Creating PostgreSQL backup at $backup_file"
compose exec -T postgres sh -ec 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip -9 > "$backup_file"

chmod 600 "$backup_file"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$backup_file" > "${backup_file}.sha256"
  chmod 600 "${backup_file}.sha256"
fi

log "Backup completed: $backup_file"
