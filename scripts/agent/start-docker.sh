#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

echo "Starting Docker containers..." >&2
cd "$PROJECT_ROOT"
docker compose up -d

echo "Waiting for app to be ready..." >&2
elapsed=0
while [ $elapsed -lt 30 ]; do
    if curl -sf http://localhost:8080/api/tasks > /dev/null 2>&1; then
        echo "App ready" >&2
        exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

echo "Timeout waiting for app" >&2
exit 1
