#!/usr/bin/env bash
# Recreate production Compose services after git is already at the target SHA.
# Used by GitHub Actions and by a human SSH session.
set -euo pipefail

ROOT="${PROD_ROOT:-/opt/nuvia-backend}"
COMPOSE=(docker compose -f docker-compose.prod.yaml)
BEFORE_SHA="${BEFORE_SHA:-}"
API_IMAGE_PRELOADED="${API_IMAGE_PRELOADED:-0}"

cd "$ROOT"

if [[ -z "$BEFORE_SHA" || "$BEFORE_SHA" =~ ^0+$ ]]; then
  changed=""
else
  changed="$(git diff --name-only "$BEFORE_SHA" HEAD || true)"
fi

needs_evolution=0
needs_caddy=0
needs_stack=0

if printf '%s\n' "$changed" | grep -q '^docker/evolution/'; then
  needs_evolution=1
fi
if printf '%s\n' "$changed" | grep -q '^docker/caddy/'; then
  needs_caddy=1
fi
if printf '%s\n' "$changed" | grep -qE '^(docker-compose.prod.yaml|docker/init-databases.sql)$'; then
  needs_stack=1
fi

if [[ "$needs_stack" -eq 1 ]]; then
  "${COMPOSE[@]}" up -d --build db redis evolution-api caddy
elif [[ "$needs_evolution" -eq 1 ]]; then
  "${COMPOSE[@]}" up -d --build evolution-api
fi

if [[ "$API_IMAGE_PRELOADED" -eq 1 ]]; then
  "${COMPOSE[@]}" up -d --no-deps --no-build api
else
  "${COMPOSE[@]}" up -d --build --no-deps api
fi

if [[ "$needs_caddy" -eq 1 && "$needs_stack" -eq 0 ]]; then
  "${COMPOSE[@]}" up -d --no-deps --force-recreate caddy
fi

"${COMPOSE[@]}" ps
