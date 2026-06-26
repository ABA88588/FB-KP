#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_ROOT}/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.production}"
STATE_DIR="${STATE_DIR:-${PROJECT_ROOT}/.deploy-state}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

docker_compose_available() {
  docker compose version >/dev/null 2>&1
}

check_env_file() {
  [[ -f "$ENV_FILE" ]] || die "Missing env file: $ENV_FILE"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

read_env_key() {
  local key="$1"
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  printf '%s' "$line"
}

require_env_keys() {
  check_env_file
  local key
  local missing=0

  for key in "$@"; do
    if ! grep -Eq "^[[:space:]]*${key}=" "$ENV_FILE"; then
      log "MISSING env key: $key"
      missing=1
    fi
  done

  [[ "$missing" -eq 0 ]] || die "Required env keys are missing from $ENV_FILE"
}

require_not_placeholder() {
  local key="$1"
  local value
  value="$(read_env_key "$key")"

  if [[ -z "$value" || "$value" =~ change_me|replace_me|example\.com ]]; then
    die "$key is empty or still a placeholder"
  fi
}

acquire_deploy_lock() {
  mkdir -p "$STATE_DIR"
  chmod 700 "$STATE_DIR"

  if ! mkdir "${STATE_DIR}/deploy.lock" 2>/dev/null; then
    die "Deployment lock already exists at ${STATE_DIR}/deploy.lock"
  fi

  trap 'rm -rf "${STATE_DIR}/deploy.lock"' EXIT
}

require_compose_files() {
  [[ -f "$COMPOSE_FILE" ]] || die "Missing compose file: $COMPOSE_FILE"
  [[ -f "${PROJECT_ROOT}/Caddyfile" ]] || die "Missing Caddyfile"
}
