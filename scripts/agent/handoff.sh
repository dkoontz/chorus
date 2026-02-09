#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$PROJECT_ROOT/.env" ] && set -a && source "$PROJECT_ROOT/.env" && set +a

if [ $# -lt 3 ]; then
    echo "Usage: handoff.sh <task-id> <agent-name> <prompt>" >&2
    exit 1
fi

TASK_ID="$1"
AGENT_NAME="$2"
PROMPT="$3"

BASE_URL="http://localhost:8080"

# Escape the prompt for JSON
JSON_PROMPT=$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')

# Start the handoff
BODY="{\"agentName\":\"${AGENT_NAME}\",\"prompt\":${JSON_PROMPT}}"

RESPONSE=$(curl -s -w '\n%{http_code}' -X POST \
    -H 'Content-Type: application/json' \
    -d "$BODY" \
    "${BASE_URL}/api/tasks/${TASK_ID}/handoff")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_CONTENT=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 400 ]; then
    echo "Handoff failed (HTTP ${HTTP_CODE}): ${BODY_CONTENT}" >&2
    exit 1
fi

echo "Handoff started for agent ${AGENT_NAME} on task ${TASK_ID}" >&2

# Poll until currentAgent is null (handoff completed)
POLL_INTERVAL=5
MAX_WAIT=600
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))

    TASK_RESPONSE=$(curl -s "${BASE_URL}/api/tasks/${TASK_ID}")
    CURRENT_AGENT=$(echo "$TASK_RESPONSE" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("data",{}).get("currentAgent","null") or "null")' 2>/dev/null || echo "error")

    if [ "$CURRENT_AGENT" = "null" ]; then
        # Handoff completed, extract the last agentChain entry's output
        OUTPUT=$(echo "$TASK_RESPONSE" | python3 -c '
import json, sys
d = json.load(sys.stdin)
chain = d.get("data", {}).get("agentChain", [])
if chain:
    print(chain[-1].get("output", ""))
else:
    print("")
' 2>/dev/null || echo "")
        echo "$OUTPUT"
        exit 0
    fi

    echo "Waiting for agent ${AGENT_NAME} to complete... (${ELAPSED}s)" >&2
done

echo "Timed out waiting for agent ${AGENT_NAME} after ${MAX_WAIT}s" >&2
exit 1
