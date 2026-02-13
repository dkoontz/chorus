# Fix CLI Tool Restrictions and Clean Up Tool Architecture

## Summary
Three related problems with the tool architecture:

1. **Tool restriction bug**: The Claude Code provider passes Chorus-internal tool names (`file.read`, `web.search`) directly to the CLI's `--tools` flag. The CLI doesn't recognize these, so agents get access to ALL built-in tools (`Task`, `Edit`, `Write`, etc.).

2. **Dead tool binaries**: The `packages/tools/` directory contains four outdated entry points (`FileToolsMain`, `HandoffMain`, `TaskToolsMain`, `CombinedMain`) from when tools were standalone executables. Only `ChorusToolsMain` (the API proxy) is current, but the build script still compiles all of them.

3. **Handoff special-cased in tool binary**: `ChorusToolsMain.gren` has a `dispatchHandoff` special case that imports `Tools.Handoff` and runs a start+poll pattern client-side. Handoff should go through the server like all other tools — the server should handle the full lifecycle (record handoff, start agent, collect output, return response).

## Part 1: Fix Tool Name Mapping

### The Bug
1. Agent config defines `allowedTools` as Chorus names: `["file.read", "file.write", "handoff"]`
2. `buildShellCommandForProvider` (`Main.gren:385`) joins them: `"file.read file.write handoff"`
3. `ClaudeCode.buildShellCommand` passes this directly to `--tools` and `--allowedTools`
4. Claude CLI receives `--tools "file.read file.write handoff"` — none recognized
5. Result: all built-in tools remain available

When `allowedTools` is empty/Nothing, the provider correctly falls back to `Bash(chorusToolsPath *)`. The bug is only in the non-empty case.

### Implementation

Add a mapping function to `ClaudeCode.gren`:

```gren
chorusToolsToCliFlags : String -> String -> { tools : String, allowedTools : String }
chorusToolsToCliFlags chorusToolsPath chorusToolNames =
```

Classification rules:
- `file.read`, `file.write`, `file.create`, `file.patch`, `file.delete`, `file.list`, `file.search`, `handoff` → `Bash(chorusToolsPath *)`
- `web.search` → `WebSearch`
- Unrecognized names → ignored (do NOT pass through — that's what caused this bug)
- Empty result → fall back to `Bash(chorusToolsPath *)`

Update both `buildCliArgs` (line ~339) and `buildShellCommand` (line ~406) to call this mapping instead of passing Chorus tool names verbatim.

### Files to Modify
- `packages/chorus/src/Provider/ClaudeCode.gren` — add mapping function, update both builders
- `packages/chorus/tests/unit/RegistryTests.gren` — add unit tests for the mapping

### Acceptance Criteria
- [ ] `["file.read", "file.write"]` → `--tools "Bash" --allowedTools "Bash(chorusToolsPath *)"`
- [ ] `["web.search"]` → `--tools "WebSearch" --allowedTools "WebSearch"`
- [ ] `["file.read", "web.search"]` → `--tools "Bash WebSearch" --allowedTools "Bash(chorusToolsPath *) WebSearch"`
- [ ] `["handoff", "file.read"]` → `--tools "Bash" --allowedTools "Bash(chorusToolsPath *)"`
- [ ] Empty/Nothing → `--tools "Bash" --allowedTools "Bash(chorusToolsPath *)"` (unchanged)
- [ ] `Task`, `Edit`, `Write`, `Read`, `Grep`, `Glob` are never available to agents

### Out of Scope (Part 1)
- **Fine-grained file tool restrictions for CLI providers**: The CLI restricts at the Bash command level (`Bash(chorus-tools *)`), not at individual tools within the binary. An agent with `["file.read"]` can technically invoke `file.write` through the same binary. Fine-grained CLI enforcement would require the binary to accept a tool whitelist parameter.

## Part 2: Remove Dead Tool Binaries

### What to Remove
The `packages/tools/` directory has four entry points that are no longer used:

| File | Binary | Status |
|------|--------|--------|
| `CombinedMain.gren` | (none — never built) | Old combined file-tools + handoff binary. Superseded by API proxy approach. |
| `FileToolsMain.gren` | `file-tools` | Old standalone file operations. Server now handles file tools directly via `ToolExecution.gren`. |
| `HandoffMain.gren` | `handoff-tool` | Old standalone handoff. Superseded by API proxy approach. |
| `TaskToolsMain.gren` | `task-tools` | Old standalone task status tool. Server handles task queries directly. |

### Shared Modules
The `Tools/` directory has shared modules. After removing dead entry points:

| Module | Used By | Action |
|--------|---------|--------|
| `Tools.File` | `ToolExecution.gren` (chorus) | **Keep** — server uses this for file tool execution |
| `Tools.Json` | `ToolExecution.gren` (chorus) | **Keep** — server uses `decodeRequest` and file encoders |
| `Tools.Validation` | `ToolExecution.gren` (chorus) | **Keep** — server uses `makeAllowedDirectories` |
| `Tools.Handoff` | `ChorusToolsMain.gren` only (after removing dead mains) | **Remove** — see Part 3 |
| `Tools.Cli` | Dead mains only | **Remove** |
| `Tools.TaskJson` | `TaskToolsMain.gren` only | **Remove** |
| `Tools.TaskStatus` | `Tools.TaskJson` only | **Remove** |
| `Tools.Help` | `Tools.Json` | **Keep** (used transitively by server) |

### Clean Up `Tools.Json`
`Tools.Json` currently imports `Tools.Handoff` for the `HandoffRequest` variant in `ToolRequest` and `encodeHandoffOutput`. The server's `ToolExecution.gren` handles handoff by tool name _before_ decoding, so `HandoffRequest` is unused on the server side. Remove:
- `HandoffRequest` variant from `ToolRequest`
- `import Tools.Handoff`
- `encodeHandoffOutput`
- `handoffInputDecoder` (the `"handoff"` case in `requestDecoder`)

### Update Build Script
`package.json` `build:tools` currently compiles four binaries. Replace with just:

```
cd packages/tools && gren make ChorusToolsMain --output=build/chorus-tools-tmp && tail -n +2 build/chorus-tools-tmp > build/chorus-tools.js && bun build --compile build/chorus-tools.js --outfile build/chorus-tools && rm build/chorus-tools-tmp build/chorus-tools.js
```

### Files to Modify
- **Delete**: `FileToolsMain.gren`, `HandoffMain.gren`, `TaskToolsMain.gren`, `CombinedMain.gren`
- **Delete**: `Tools/Cli.gren`, `Tools/TaskJson.gren`, `Tools/TaskStatus.gren`
- **Edit**: `Tools/Json.gren` — remove `HandoffRequest`, `encodeHandoffOutput`, `import Tools.Handoff`
- **Edit**: `package.json` — simplify `build:tools` script

### Acceptance Criteria
- [ ] Dead entry points and unused modules are deleted
- [ ] `Tools.Json` no longer depends on `Tools.Handoff`
- [ ] `build:tools` only compiles `chorus-tools`
- [ ] `npm run build:all` succeeds
- [ ] All existing tests pass

## Part 3: Remove Handoff Special Case from Tool Binary

### Current State
`ChorusToolsMain.gren` has two code paths:
- **Regular tools** → `forwardToServer` → `POST /api/tasks/:id/tools` → server handles it
- **Handoff** → `dispatchHandoff` → `Handoff.run` → starts agent via API, polls for completion client-side

The handoff special case:
1. Imports `Tools.Handoff` (start+poll logic with curl subprocesses)
2. Decodes the handoff params locally
3. Calls `POST /api/tasks/:id/handoff` to start the agent
4. Polls `GET /api/tasks/:id` in a loop until `currentAgent` is null
5. Extracts the agent output from `agentChain`

This should be server-side. The tool binary should be a pure proxy for ALL tools.

### Target Architecture
`ChorusToolsMain.gren` becomes a simple proxy:

```gren
dispatchTool env childProcessPermission baseUrl taskId jsonInput =
    -- Forward everything to the server
    forwardToServer env childProcessPermission baseUrl taskId jsonInput
```

No special cases. No `Tools.Handoff` import. No polling logic.

### Server Changes
The server's `ToolExecution.gren` currently rejects `"handoff"` with "Use POST /api/tasks/:id/handoff". Instead, it needs to handle the full handoff lifecycle synchronously (from the HTTP client's perspective):

1. Tool endpoint receives `{"tool":"handoff","agentName":"writer","prompt":"..."}`
2. Server starts the handoff: update task, record `agent_handoff_started` event, spawn agent
3. Server holds the HTTP response open (deferred response)
4. Agent runs to completion → `GotAgentComplete` fires
5. Server completes the handoff: record `agent_handoff_completed` event, clear `currentAgent`
6. Server sends the HTTP response with the agent's output
7. Tool binary receives response, returns it to the calling CLI agent

This requires:
- **Model change**: Add a field to track pending handoff tool responses (maps task ID to deferred HTTP response callback)
- **`ToolExecution.gren`**: Handle `"handoff"` by starting the handoff and storing the deferred response
- **`Main.gren` `GotAgentComplete`**: Check for a pending deferred handoff response and send it
- **Timeout handling**: If the agent doesn't complete within a reasonable time (10 min), send an error response

This gives a unified execution model: both CLI and API providers use the same server-side tool execution path.

### Files to Modify
- **Edit**: `packages/tools/src/ChorusToolsMain.gren` — remove `dispatchHandoff`, `handleResult`, `import Tools.Handoff`; forward all tools through `forwardToServer`
- **Delete**: `packages/tools/src/Tools/Handoff.gren` — no longer needed
- **Edit**: `packages/chorus/src/Web/ToolExecution.gren` — handle `"handoff"` tool requests (deferred response pattern)
- **Edit**: `packages/chorus/src/Main.gren` — model field for pending handoff responses; update `GotAgentComplete` to resolve them

### Acceptance Criteria
- [ ] `ChorusToolsMain.gren` has no special cases — all tools forwarded to server
- [ ] `Tools.Handoff` module is deleted
- [ ] Server handles handoff tool requests end-to-end (start agent, wait, return output)
- [ ] CLI agents can invoke handoff through `chorus-tools` and receive the sub-agent's output
- [ ] Existing handoff API endpoint (`POST /api/tasks/:id/handoff`) continues to work for other callers
- [ ] `npm run build:all` succeeds
- [ ] All existing tests pass

## Testing Requirements
- Build with `npm run build:all` to verify compilation
- Run `npm run test` to verify no regressions
- New unit tests for the tool name mapping function (Part 1)
- Manual verification: start the app, trigger a handoff via a CLI agent, verify it completes through the server

## Notes
- The `--tools` flag controls tool **availability** (hard restriction). `--allowedTools` controls which tools **skip permission prompts** (soft restriction). Both must be set correctly.
- `chorusToolsPath` resolves to `./tools/chorus-tools` by default (`Config.gren:41`), overridable via `CHORUS_TOOLS_PATH` env var.
- The `forwardToServer` function in `ChorusToolsMain.gren` already has a 600-second curl timeout, matching the max wait time that was in `Handoff.run`.
- The deferred response pattern (Part 3) requires the server to hold an HTTP connection open while the agent runs. This is fine for Node.js (no connection timeout by default) but should be noted.
- `Tools.File`, `Tools.Json`, `Tools.Validation`, and `Tools.Help` must be preserved — they're used by the chorus server's `ToolExecution.gren`.
