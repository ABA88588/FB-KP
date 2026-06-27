#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=deploy/lib.sh
source "${SCRIPT_DIR}/lib.sh"

need_cmd docker
docker_compose_available || die "Docker Compose v2 plugin is required"
require_compose_files
check_env_file

target_tag="${1:-${ROLLBACK_IMAGE_TAG:-}}"
if [[ -z "$target_tag" && -f "${STATE_DIR}/previous-image-tag" ]]; then
  target_tag="$(cat "${STATE_DIR}/previous-image-tag")"
fi

[[ -n "$target_tag" ]] || die "Provide a rollback image tag or keep ${STATE_DIR}/previous-image-tag from a prior deploy"

acquire_deploy_lock
export IMAGE_TAG="$target_tag"

log "Rolling back web and worker images to tag: $target_tag"
compose up -d web worker reverse-proxy

log "Running health checks after rollback."
"${SCRIPT_DIR}/healthcheck.sh"

printf '%s\n' "$target_tag" > "${STATE_DIR}/last-image-tag"
log "Rollback completed."
