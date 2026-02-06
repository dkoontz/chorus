#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

if [ $# -lt 2 ]; then
    echo "Usage: curl-api.sh <METHOD> <PATH> [BODY]" >&2
    exit 1
fi

METHOD="$1"
PATH_ARG="$2"
BODY="${3:-}"

BASE_URL="http://localhost:8080"
URL="${BASE_URL}${PATH_ARG}"

CURL_ARGS=(-s -w '\n%{http_code}' -X "$METHOD")

if [ -n "$BODY" ]; then
    CURL_ARGS+=(-H 'Content-Type: application/json' -d "$BODY")
fi

RESPONSE=$(curl "${CURL_ARGS[@]}" "$URL")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_CONTENT=$(echo "$RESPONSE" | sed '$d')

echo "HTTP $HTTP_CODE" >&2

if command -v jq > /dev/null 2>&1; then
    echo "$BODY_CONTENT" | jq . 2>/dev/null || echo "$BODY_CONTENT"
else
    echo "$BODY_CONTENT"
fi
