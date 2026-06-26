#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib.sh
source "${SCRIPT_DIR}/lib.sh"

CHECK_ONLY=false
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=true
fi

status_line() {
  printf '%-28s %s\n' "$1" "$2"
}

check_port_80() {
  if command -v ss >/dev/null 2>&1; then
    if ss -ltn '( sport = :80 )' | grep -q ':80'; then
      printf 'in_use'
    else
      printf 'available'
    fi
  else
    printf 'unknown'
  fi
}

run_checks() {
  local overall="PASS"
  local port_status

  echo "PRECHECK fbkp self-hosted deployment"
  status_line "timestamp_utc" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  status_line "project_root" "$PROJECT_ROOT"

  if command -v docker >/dev/null 2>&1; then
    status_line "docker" "ok ($(docker --version))"
  else
    status_line "docker" "missing"
    overall="FAIL"
  fi

  if docker_compose_available; then
    status_line "docker_compose" "ok ($(docker compose version --short 2>/dev/null || docker compose version))"
  else
    status_line "docker_compose" "missing"
    overall="FAIL"
  fi

  [[ -f "$COMPOSE_FILE" ]] && status_line "compose_file" "present" || { status_line "compose_file" "missing"; overall="FAIL"; }
  [[ -f "${PROJECT_ROOT}/Caddyfile" ]] && status_line "caddyfile" "present" || { status_line "caddyfile" "missing"; overall="FAIL"; }
  [[ -f "$ENV_FILE" ]] && status_line "env_file" "present" || { status_line "env_file" "missing (copy .env.production.example)"; overall="FAIL"; }
  port_status="$(check_port_80)"
  status_line "host_port_80" "$port_status"
  [[ "$port_status" != "in_use" ]] || overall="FAIL"
  status_line "secret_values" "not printed"
  status_line "overall" "$overall"

  [[ "$overall" == "PASS" ]]
}

if [[ "$CHECK_ONLY" == "true" ]]; then
  run_checks
  exit $?
fi

need_cmd docker
docker_compose_available || die "Docker Compose v2 plugin is required"
require_compose_files

mkdir -p "$STATE_DIR" "$BACKUP_DIR"
chmod 700 "$STATE_DIR" "$BACKUP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${PROJECT_ROOT}/.env.production.example" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log "Created $ENV_FILE from .env.production.example; replace placeholders before deploy."
else
  chmod 600 "$ENV_FILE"
  log "Env file exists; permissions set to 600."
fi

run_checks
