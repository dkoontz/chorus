#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LOG_FILE="/tmp/$(echo "$PROJECT_ROOT" | tr '/' '-').log"
DATA_DIR="$PROJECT_ROOT/dist/data"

# Determine port: CLI args (passed through) > CHORUS_PORT env var > default 8080
PORT="${CHORUS_PORT:-8080}"

# Check if --port was passed as a script argument and forward to chorus binary
CHORUS_ARGS=""
while [ $# -gt 0 ]; do
    if [ "$1" = "--port" ] && [ -n "$2" ]; then
        PORT="$2"
        CHORUS_ARGS="$CHORUS_ARGS --port $2"
        shift 2
    else
        CHORUS_ARGS="$CHORUS_ARGS $1"
        shift
    fi
done

# Create data directory if needed
mkdir -p "$DATA_DIR"

# Truncate log file
: > "$LOG_FILE"

echo "Starting app..." >&2
cd "$PROJECT_ROOT/dist"
./chorus $CHORUS_ARGS > "$LOG_FILE" 2>&1 &
echo $! > "$PROJECT_ROOT/dist/data/.pid"

echo "Waiting for app to be ready..." >&2
elapsed=0
while [ $elapsed -lt 30 ]; do
    if curl -so /dev/null "http://localhost:${PORT}/api/config" 2>/dev/null; then
        echo "App ready on http://localhost:${PORT}" >&2
        exit 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

echo "Timeout waiting for app" >&2
exit 1
