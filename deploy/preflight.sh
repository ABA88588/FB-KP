#!/usr/bin/env bash
set -euo pipefail

command -v docker >/dev/null || { echo "docker is missing"; exit 1; }
docker compose version >/dev/null || { echo "docker compose plugin is missing"; exit 1; }

if ss -ltn | awk '{print $4}' | grep -Eq '(:80)$'; then
  echo "port 80 is already in use"
  exit 1
fi

echo "preflight ok"
