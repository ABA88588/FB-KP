#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib.sh
source "${SCRIPT_DIR}/lib.sh"

need_cmd docker
docker_compose_available || die "Docker Compose v2 plugin is required"
require_compose_files
require_env_keys \
  APP_BASE_URL \
  META_OAUTH_REDIRECT_URI \
  POSTGRES_PASSWORD \
  DATABASE_URL \
  REDIS_PASSWORD \
  REDIS_URL \
  AUTH_SECRET \
  TOKEN_ENCRYPTION_KEY \
  TOKEN_ENCRYPTION_KEY_BASE64 \
  META_GRAPH_API_VERSION \
  META_DEMO_MODE \
  ENABLE_META_WRITES

require_not_placeholder APP_BASE_URL
require_not_placeholder POSTGRES_PASSWORD
require_not_placeholder DATABASE_URL
require_not_placeholder REDIS_PASSWORD
require_not_placeholder REDIS_URL
require_not_placeholder AUTH_SECRET
require_not_placeholder TOKEN_ENCRYPTION_KEY
require_not_placeholder TOKEN_ENCRYPTION_KEY_BASE64

if [[ "$(read_env_key ENABLE_META_WRITES)" == "true" ]]; then
  require_env_keys META_APP_ID META_APP_SECRET
  require_not_placeholder META_APP_ID
  require_not_placeholder META_APP_SECRET
fi

acquire_deploy_lock
mkdir -p "$STATE_DIR"

current_tag="$(read_env_key IMAGE_TAG)"
previous_tag=""
if [[ -f "${STATE_DIR}/last-image-tag" ]]; then
  previous_tag="$(cat "${STATE_DIR}/last-image-tag")"
fi

log "Validating compose file without printing expanded config."
compose config --quiet

log "Pulling base service images."
compose pull postgres redis reverse-proxy

log "Building application images."
compose build web worker

log "Starting production services."
compose up -d postgres redis
compose up -d web worker reverse-proxy

log "Running health checks."
"${SCRIPT_DIR}/healthcheck.sh"

if [[ -n "$previous_tag" ]]; then
  printf '%s\n' "$previous_tag" > "${STATE_DIR}/previous-image-tag"
fi
printf '%s\n' "${current_tag:-local}" > "${STATE_DIR}/last-image-tag"

log "Deployment completed."
