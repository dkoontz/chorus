#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

cd "$PROJECT_ROOT"
docker compose ps >&2

if curl -sf http://localhost:8080/api/tasks > /dev/null 2>&1; then
    echo "running"
else
    echo "stopped"
    echo "Last 20 lines of container logs:" >&2
    docker compose logs --tail=20 >&2 || true
fi
