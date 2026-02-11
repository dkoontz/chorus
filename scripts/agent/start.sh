#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LOG_FILE="/tmp/$(echo "$PROJECT_ROOT" | tr '/' '-').log"
DATA_DIR="$PROJECT_ROOT/dist/data"

# Create data directory if needed
mkdir -p "$DATA_DIR"

# Truncate log file
: > "$LOG_FILE"

echo "Starting app..." >&2
cd "$PROJECT_ROOT/dist"
./chorus > "$LOG_FILE" 2>&1 &
echo $! > "$PROJECT_ROOT/dist/data/.pid"

echo "Waiting for app to be ready..." >&2
elapsed=0
while [ $elapsed -lt 30 ]; do
    if curl -so /dev/null http://localhost:8080/api/config 2>/dev/null; then
        echo "App ready on http://localhost:8080" >&2
        exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

echo "Timeout waiting for app" >&2
exit 1
