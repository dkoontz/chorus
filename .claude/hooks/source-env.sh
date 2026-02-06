#!/bin/bash
# PreToolUse hook that sources .env before each Bash command
# This allows environment variables to be changed mid-session

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

# Only modify Bash commands
if [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Skip if no command or if it's just setting env vars
if [ -z "$COMMAND" ]; then
  exit 0
fi

# Reject commands that chain multiple operations with &&, &, or ;
if echo "$COMMAND" | grep -qE '&&|;|&'; then
  jq -n --arg reason "Commands must not contain '&&', '&', or ';'. Run each command separately instead." '{
    decision: "block",
    reason: $reason
  }'
  exit 0
fi

# Prepend sourcing .env (set -a exports all vars, set +a turns it off)
# The 2>/dev/null handles case where .env doesn't exist
MODIFIED="set -a; source .env 2>/dev/null; set +a; $COMMAND"

# Return modified command
jq -n --arg cmd "$MODIFIED" '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    modifiedToolInput: { command: $cmd }
  }
}'
