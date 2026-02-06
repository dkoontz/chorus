#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

cd "$PROJECT_ROOT"

case "${1:-}" in
    unit)
        echo "Running unit tests..." >&2
        npm run test:unit
        ;;
    integration)
        echo "Running integration tests..." >&2
        npm run test:integration
        ;;
    "")
        echo "Running all tests..." >&2
        npm run test
        ;;
    *)
        echo "Usage: test.sh [unit|integration]" >&2
        exit 1
        ;;
esac
