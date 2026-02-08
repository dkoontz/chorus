#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

LINES="${1:-50}"
LOG_FILE="/tmp/$(echo "$PROJECT_ROOT" | tr '/' '-').log"

if [ -f "$LOG_FILE" ]; then
    tail -"$LINES" "$LOG_FILE"
else
    echo "No log file found at $LOG_FILE" >&2
    exit 1
fi
