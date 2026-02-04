# Claude CLI Integration

## Summary

Replace the stubbed Claude Code SDK calls in the Gren agent executor with direct invocation of the `claude` CLI process. This approach uses the Claude Code CLI instead of the Agent SDK, enabling Pro/Max subscription support without requiring an API key.

## Architecture

The agent executor spawns `claude` CLI processes directly rather than using a TypeScript SDK bridge:

```
Gren Agent Executor
       |
   spawn process
       |
       v
claude CLI
  --system-prompt "agent prompt"
  --session-id "uuid"
  --resume "session-id" (for continuing sessions)
  --output-format stream-json --verbose
  --tools "Bash"
  --allowedTools "Bash(file-tools *)"
  --add-dir "/workspace/path"
  --permission-mode bypassPermissions
  -p "user message"
       |
       v
file-tools binary (via restricted Bash)
```

## Requirements

- **Add environment validation to Provider interface** - Each provider can validate its prerequisites are met
- Remove the TypeScript SDK bridge entirely (no longer needed)
- Update Gren agent executor to spawn `claude` CLI directly via `Process.spawn`
- Parse streaming JSON output from CLI to extract responses and tool calls
- Manage sessions using `--session-id` (new session) or `--resume` (existing session) flags
- Restrict available tools to only `Bash` with `--allowedTools "Bash(file-tools *)"` pattern
- Allow workspace directory access via `--add-dir`
- Use `--permission-mode bypassPermissions` to auto-approve file-tools commands

## Acceptance Criteria

### Provider Interface Enhancement
- [ ] Provider interface includes `validateEnvironment : Task ProviderError ()` function
- [ ] Validation returns clear error messages when prerequisites are missing
- [ ] Executor calls `validateEnvironment` before attempting to create sessions

### Claude Code Provider Validation
- [ ] Validates `claude` CLI is installed and accessible in PATH
- [ ] Validates `file-tools` binary exists at expected location
- [ ] Returns `EnvironmentError` with actionable message if validation fails

### CLI Integration
- [ ] TypeScript SDK bridge code removed from project
- [ ] Gren executor spawns `claude` CLI process with correct flags
- [ ] Agent system prompt passed via `--system-prompt` flag
- [ ] Streaming JSON output parsed correctly (system init, assistant messages, tool results, final result)
- [ ] Session ID captured from `system.init` message and stored for resume
- [ ] Session resume works using `--resume <session-id>` flag
- [ ] Tool restrictions enforced via `--tools "Bash"` and `--allowedTools "Bash(file-tools *)"`
- [ ] Workspace directory added via `--add-dir` for file-tools access
- [ ] Error handling for CLI failures, permission denials, and malformed output

### Testing
- [ ] Unit tests for environment validation logic
- [ ] Integration test: send message, receive response with tool use, session resumes correctly

## Out of Scope

- Support for API key authentication (this task focuses on Pro/Max subscription flow)
- Multiple concurrent sessions in a single process
- Interactive mode (always use `-p` flag for non-interactive operation)
- Custom MCP servers (use built-in Bash tool with restrictions)

## Technical Context

### CLI Flags Reference

Based on `claude --help`, these are the key flags:

| Flag | Description |
|------|-------------|
| `-p, --print` | Non-interactive mode, required for automation |
| `--system-prompt <prompt>` | System prompt for the session (replaces default) |
| `--append-system-prompt <prompt>` | Add to default system prompt (alternative to --system-prompt) |
| `--session-id <uuid>` | Specify session ID (must be valid UUID) |
| `-r, --resume <session-id>` | Resume existing session by ID |
| `--output-format stream-json` | Streaming JSON output (requires --verbose) |
| `--verbose` | Required for stream-json output format |
| `--tools <tools...>` | Restrict to specific tools (e.g., "Bash") |
| `--allowedTools <tools...>` | Allow specific tool patterns (e.g., "Bash(file-tools *)") |
| `--add-dir <directories...>` | Additional directories for tool access |
| `--permission-mode bypassPermissions` | Auto-approve all tool use |

### JSON Output Format

The CLI outputs newline-delimited JSON messages when using `--output-format stream-json --verbose`:

**System init message (first message):**
```json
{
  "type": "system",
  "subtype": "init",
  "session_id": "3a89518e-5ed1-4e48-b70d-536aefaf5466",
  "cwd": "/path/to/workspace",
  "tools": ["Bash"],
  "model": "claude-opus-4-5-20251101"
}
```

**Assistant message with tool use:**
```json
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "text", "text": "Let me read that file..."},
      {"type": "tool_use", "id": "toolu_abc123", "name": "Bash", "input": {"command": "file-tools /workspace read path.txt"}}
    ]
  },
  "session_id": "..."
}
```

**Tool result message:**
```json
{
  "type": "user",
  "message": {
    "content": [
      {"tool_use_id": "toolu_abc123", "type": "tool_result", "content": "file contents here"}
    ]
  },
  "tool_use_result": {"stdout": "...", "stderr": ""}
}
```

**Final result message:**
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "result": "Final response text",
  "session_id": "3a89518e-5ed1-4e48-b70d-536aefaf5466",
  "total_cost_usd": 0.05,
  "permission_denials": []
}
```

### Files to Modify

- `src/agent-executor/src/Provider.gren` - Add `validateEnvironment` to Provider interface
- `src/agent-executor/src/Provider/ClaudeCode.gren` - Replace port-based communication with CLI spawning, implement validation
- `src/agent-executor/src/Provider/Ports.gren` - Remove or simplify (no longer needs SDK bridge)
- `src/agent-executor/src/Agent/Executor.gren` - Call `validateEnvironment` before session creation

### Provider Interface Update

Add environment validation to the Provider type:

```gren
type alias Provider =
    { validateEnvironment : Task ProviderError ()
    , createSession : AgentSpec -> String -> Task ProviderError Session
    , sendMessage : Session -> String -> Task ProviderError Response
    , submitToolResults : Session -> Array ToolResult -> Task ProviderError Response
    , resumeSession : String -> Task ProviderError (Maybe Session)
    }

-- New error type for environment issues
type ProviderError
    = AuthenticationError String
    | RateLimitError String
    | NetworkError String
    | InvalidResponseError String
    | EnvironmentError String  -- NEW: missing binaries, bad config, etc.
```

### Claude Code Provider Validation

```gren
validateEnvironment : Task ProviderError ()
validateEnvironment =
    -- Check claude CLI exists
    Process.which "claude"
        |> Task.andThen
            (\maybeClaudePath ->
                when maybeClaudePath is
                    Nothing ->
                        Task.fail (EnvironmentError "claude CLI not found in PATH. Install from https://claude.ai/code")
                    Just _ ->
                        -- Check file-tools exists
                        checkFileToolsExists
            )

checkFileToolsExists : Task ProviderError ()
checkFileToolsExists =
    -- Look for file-tools in same directory as executor
    -- Return EnvironmentError if not found
```

### Files to Remove

- `src/sdk-bridge/` - Entire directory (TypeScript SDK bridge no longer needed)

### Patterns to Follow

**Spawning the CLI process:**
```
-- Build command arguments
arguments =
    [ "-p"  -- non-interactive mode
    , "--output-format", "stream-json"
    , "--verbose"
    , "--system-prompt", agentSpec.systemPrompt
    , "--tools", "Bash"
    , "--allowedTools", "Bash(file-tools *)"
    , "--add-dir", workspaceRoot
    , "--permission-mode", "bypassPermissions"
    , userMessage
    ]

-- For resume, add --resume flag instead of --session-id
resumeArguments =
    [ "-p"
    , "--output-format", "stream-json"
    , "--verbose"
    , "--resume", sessionId
    , "--tools", "Bash"
    , "--allowedTools", "Bash(file-tools *)"
    , "--add-dir", workspaceRoot
    , "--permission-mode", "bypassPermissions"
    , userMessage
    ]
```

**Parsing streaming output:**
```
-- Each line is a separate JSON object
-- Parse line by line, handling:
--   type: "system", subtype: "init" -> capture session_id
--   type: "assistant" -> extract text and tool_use blocks
--   type: "user" -> tool results (handled by CLI internally)
--   type: "result" -> final response, isComplete = true
```

**Session management:**
- Generate new UUID for first message (or let CLI generate one)
- Store session ID from `system.init` response
- Use `--resume <id>` for subsequent messages in same session
- Session history is managed by CLI, not by our code

### Error Handling

Map CLI errors to `ProviderError` types:

| CLI Error | ProviderError |
|-----------|---------------|
| Exit code non-zero with auth error in output | `AuthenticationError` |
| Exit code non-zero with rate limit message | `RateLimitError` |
| Process spawn failure | `NetworkError` |
| Invalid JSON output | `InvalidResponseError` |
| `permission_denials` array non-empty | `ToolPermissionError` (new) |

The `result` message includes a `permission_denials` array listing any tool calls that were blocked.

## Testing Requirements

### Unit Tests
- Test JSON parsing for each message type (system, assistant, user, result)
- Test command argument building for new sessions vs resume
- Test error parsing from CLI exit codes and output

### Integration Tests
- End-to-end test: create session, send message, verify response
- Test session resume: send message, capture session ID, send follow-up with resume
- Test tool restrictions: verify only file-tools commands are allowed
- Test workspace access: verify file-tools can access workspace directory

### Manual Testing
```bash
# Test basic CLI invocation
echo "What is 2+2?" | claude -p --output-format stream-json --verbose

# Test with system prompt
echo "Say hello" | claude -p --output-format stream-json --verbose \
  --system-prompt "You are a helpful assistant named Bob."

# Test session resume
SESSION=$(echo "Remember 42" | claude -p --output-format json | jq -r '.session_id')
echo "What number?" | claude -p --output-format json --resume "$SESSION"

# Test tool restrictions
echo "List files in the workspace" | claude -p --output-format stream-json --verbose \
  --tools "Bash" \
  --allowedTools "Bash(file-tools *)" \
  --add-dir "/path/to/workspace" \
  --permission-mode bypassPermissions
```

## Implementation Notes

### Authentication

The Claude CLI uses the user's existing Claude authentication (Pro/Max subscription). No API key configuration is required. The CLI handles authentication automatically.

### Tool Execution Flow

Unlike the SDK approach where we intercept tool calls, the CLI executes tools internally:

1. Claude decides to use a tool
2. CLI executes the tool (subject to --allowedTools restrictions)
3. CLI feeds result back to Claude
4. Process continues until Claude produces final response
5. We receive the complete conversation in streaming JSON

This means we don't need to implement tool execution - the CLI handles it. We just need to:
- Configure which tools are allowed
- Provide access to the workspace directory
- Parse the final result

### Session State

The CLI manages session state internally. We only need to store:
- Session ID (UUID from `system.init` message)
- Agent spec (for our own reference)
- Workspace root (for our own reference)

Session history, conversation context, and continuation are handled by the CLI's `--resume` flag.

### Streaming vs Batch Output

Two output format options:

1. `--output-format json` - Single JSON object with final result only
2. `--output-format stream-json --verbose` - Streaming NDJSON with all messages

Use streaming for:
- Progress visibility (seeing tool execution in real-time)
- Capturing intermediate state
- Handling long-running tasks

Use batch for:
- Simpler parsing (single JSON object)
- When only final result matters

Recommendation: Start with batch (`json`) for simplicity, add streaming later if needed.

## Dependencies

No new dependencies required. The implementation uses:
- Gren's `Process` module for spawning CLI
- Gren's `Json.Decode` for parsing output
- The `claude` CLI (assumed to be installed and in PATH)
- The `file-tools` binary (already built at `src/tools/build/file-tools`)
