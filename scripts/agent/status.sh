#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LOG_FILE="/tmp/$(echo "$PROJECT_ROOT" | tr '/' '-').log"

if curl -sf http://localhost:8080/api/tasks > /dev/null 2>&1; then
    echo "running"
else
    echo "stopped"
    if [ -f "$LOG_FILE" ]; then
        echo "Last 20 lines of log:" >&2
        tail -20 "$LOG_FILE" >&2 || true
    fi
fi
