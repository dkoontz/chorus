#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LOG_FILE="/tmp/$(echo "$PROJECT_ROOT" | tr '/' '-').log"
DATA_DIR="$PROJECT_ROOT/data"

# Create data directories if needed
mkdir -p "$DATA_DIR/registry" "$DATA_DIR/workspaces" "$DATA_DIR/uploads"

# Truncate log file
: > "$LOG_FILE"

echo "Starting app..." >&2
cd "$PROJECT_ROOT/packages/chorus"
CHORUS_DATA_DIR="$DATA_DIR" ./build/chorus > "$LOG_FILE" 2>&1 &
echo $! > "$PROJECT_ROOT/data/.pid"

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
