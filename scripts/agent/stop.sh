#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

PID_FILE="$PROJECT_ROOT/dist/data/.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "Stopping app (PID $PID)..." >&2
        kill "$PID"
        # Wait for process to exit
        elapsed=0
        while kill -0 "$PID" 2>/dev/null; do
            if [ $elapsed -ge 10 ]; then
                echo "Force killing app..." >&2
                kill -9 "$PID" 2>/dev/null || true
                break
            fi
            sleep 1
            elapsed=$((elapsed + 1))
        done
        echo "App stopped." >&2
    else
        echo "App not running (stale PID file)." >&2
    fi
    rm -f "$PID_FILE"
else
    # Fallback: try to find and kill the process
    if pkill -f 'dist/chorus' 2>/dev/null; then
        echo "App stopped." >&2
    else
        echo "App not running." >&2
    fi
fi
