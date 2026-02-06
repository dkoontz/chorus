#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

echo "Building app + Docker image..." >&2
cd "$PROJECT_ROOT"
npm run build:all
echo "Build complete." >&2
