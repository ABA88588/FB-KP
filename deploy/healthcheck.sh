#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib.sh
source "${SCRIPT_DIR}/lib.sh"

need_cmd docker
docker_compose_available || die "Docker Compose v2 plugin is required"
require_compose_files
check_env_file

http_get() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 10 "$url" >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -q -T 10 -O /dev/null "$url"
  else
    die "curl or wget is required for HTTP health checks"
  fi
}

ok() {
  printf '[OK] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

for service in postgres redis web worker reverse-proxy; do
  if compose ps --status running --services | grep -qx "$service"; then
    ok "$service container running"
  else
    fail "$service container is not running"
  fi
done

compose exec -T postgres sh -ec 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null \
  && ok "postgres ready" \
  || fail "postgres not ready"

compose exec -T redis sh -ec 'redis-cli -a "$REDIS_PASSWORD" --no-auth-warning ping | grep -q PONG' \
  && ok "redis ready" \
  || fail "redis not ready"

health_url="${HEALTHCHECK_URL:-$(read_env_key HEALTHCHECK_URL)}"
health_url="${health_url:-http://127.0.0.1/ads/api/health/live}"
http_get "$health_url" \
  && ok "reverse proxy HTTP health check succeeded" \
  || fail "reverse proxy HTTP health check failed"
