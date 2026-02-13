# Developer Report

## Task
Fix CLI tool restrictions (tool name mapping bug), remove dead tool binaries, and remove the handoff special case from the tool binary by moving handoff execution to the server.

## Files Modified

### Part 1: Fix Tool Name Mapping
- `packages/chorus/src/Provider/ClaudeCode.gren` - Added `chorusToolsToCliFlags` function that maps Chorus tool names (file.read, web.search, handoff, etc.) to Claude CLI flags (Bash, WebSearch). Updated both `buildCliArgs` and `buildShellCommand` to use the mapping instead of passing Chorus tool names verbatim.
- `packages/chorus/tests/unit/RegistryTests.gren` - Added 6 unit tests for `chorusToolsToCliFlags`: file read/write, web search, mixed tools, handoff+file.read, empty input fallback, and unrecognized tool names.

### Part 2: Remove Dead Tool Binaries
- **Deleted** `packages/tools/src/FileToolsMain.gren` - Old standalone file operations binary
- **Deleted** `packages/tools/src/HandoffMain.gren` - Old standalone handoff binary
- **Deleted** `packages/tools/src/TaskToolsMain.gren` - Old standalone task tools binary
- **Deleted** `packages/tools/src/CombinedMain.gren` - Old combined binary (was never built)
- **Deleted** `packages/tools/src/Tools/Cli.gren` - Shared CLI helpers used only by dead mains
- **Deleted** `packages/tools/src/Tools/TaskJson.gren` - Task tool JSON used only by TaskToolsMain
- **Deleted** `packages/tools/src/Tools/TaskStatus.gren` - Task status operations used only by TaskJson
- **Deleted** `packages/tools/src/Tools/Handoff.gren` - Client-side handoff start+poll logic (Part 3)
- `packages/tools/src/Tools/Json.gren` - Removed `HandoffRequest` variant from `ToolRequest`, removed `encodeHandoffOutput`, removed `import Tools.Handoff`, removed `handoffInputDecoder`
- `package.json` - Simplified `build:tools` script to only compile `ChorusToolsMain` (was compiling 4 binaries)

### Part 3: Remove Handoff Special Case from Tool Binary
- `packages/tools/src/ChorusToolsMain.gren` - Removed `dispatchHandoff`, `handleResult`, and `import Tools.Handoff`. All tools now go through `forwardToServer` with no special cases.
- `packages/chorus/src/Web/Api.gren` - Added `DeferredHandoff` variant to `ApiResult` type; added handler in `sendApiResponse` for the new variant
- `packages/chorus/src/Web/ToolExecution.gren` - Changed handoff from returning a 400 error to returning `DeferredHandoff` with agentName and prompt; added `dispatchHandoffTool` function; updated module doc comment
- `packages/chorus/src/Main.gren` - Added `pendingHandoffResponses` field to Model; added `GotDeferredHandoffLookup` and `GotDeferredHandoffStarted` message variants; added handlers that look up the agent, start the handoff via `requestStartHandoff`, store the deferred HTTP response, and spawn the agent; updated `GotAgentComplete` to check for pending deferred responses and send the agent output back to the tool binary; added `DeferredHandoff` branches to all `when` patterns matching `ApiResult`

## Build Status
**Status:** PASS

```
> npm run build:all
Success! Compiled 13 modules. (UI)
Success! Compiled 5 modules. (tools - only chorus-tools now)
Success! Compiled 22 modules. (chorus)
dist/ assembled.
```

## Test Status
**Status:** PASS

```
Running 68 tests...
68 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes

- The `chorusToolsToCliFlags` mapping function deduplicates tool flags. For example, `["file.read", "file.write", "handoff"]` all map to `Bash(chorusToolsPath *)`, and deduplication ensures only one `Bash` entry appears in the flags.
- Unrecognized Chorus tool names are silently ignored (not passed through to the CLI). This is the correct behavior since passing unknown names was the root cause of the original bug.
- The deferred handoff pattern uses a two-step message flow: `GotDeferredHandoffLookup` (agent found, start handoff) -> `GotDeferredHandoffStarted` (handoff recorded, spawn agent). The HTTP response is stored in `pendingHandoffResponses` and resolved in `GotAgentComplete`.
- The `DeferredHandoff` variant was added to `ApiResult` to signal Main.gren that a handoff should be started. This required adding exhaustive pattern matches in several existing handlers. In all non-tool-result contexts, `DeferredHandoff` is handled as a no-op/passthrough since it should never occur there.
- The existing handoff API endpoint (`POST /api/tasks/:id/handoff`) continues to work unchanged for non-tool callers. Only the tool binary path changed.
- `Tools.File`, `Tools.Json`, `Tools.Validation`, and `Tools.Help` were preserved as required (used by the chorus server's `ToolExecution.gren`).

## Iteration
1
