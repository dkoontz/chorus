#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

echo "Stopping Docker containers..." >&2
cd "$PROJECT_ROOT"
docker compose down
echo "Containers stopped." >&2
