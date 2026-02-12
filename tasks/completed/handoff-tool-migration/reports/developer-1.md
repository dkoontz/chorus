# Developer Report

## Task
Migrate the handoff functionality from `scripts/agent/handoff.sh` (a shell script) into a Gren-based tool in `packages/tools/`, following the same patterns as the existing file tools. Update agent documentation and registry defaults accordingly.

## Files Modified
- `packages/tools/src/Tools/Handoff.gren` - **New file.** Handoff tool module with `HandoffInput`, `HandoffOutput`, and `HandoffError` types, plus the `run` function that uses curl via `ChildProcess` to POST to `/api/tasks/:id/handoff` and poll `GET /api/tasks/:id` until the agent completes.
- `packages/tools/src/Tools/Json.gren` - Added `HandoffRequest` variant to `ToolRequest` type, added `handoffInputDecoder` for JSON decoding, added `encodeHandoffOutput` for response encoding, added `Handoff` import.
- `packages/tools/src/Main.gren` - Added `HandoffRequest` case to `executeRequest`, imported `Tools.Handoff` and `encodeHandoffOutput`.
- `packages/chorus/src/Agent/Registry.gren` - Changed all five default agent configs' `allowedTools` from `"Bash(file-tools * scripts/agent/*)"` to `"Bash(file-tools *)"`.
- `agents/developer.md` - Added "Agent Scripts vs Tools" section clarifying the distinction.
- `agents/orchestrator.md` - Added "Agent Scripts vs Tools" section clarifying the distinction.
- `agents/developer-review.md` - Added "Agent Scripts vs Tools" section clarifying the distinction.
- `agents/qa.md` - Added "Agent Scripts vs Tools" section clarifying the distinction.
- `agents/planner.md` - Added "Agent Scripts vs Tools" section clarifying the distinction.
- `packages/tools/tests/integration/handoff.json` - **New file.** Integration test scenarios for the handoff tool (input validation, missing fields, unknown tool).

## Files Deleted
- `scripts/agent/handoff.sh` - Removed; functionality is now in the Gren handoff tool.

## Build Status
**Status:** PASS

All three packages compile without errors:
- `packages/chorus-ui` - 7 modules compiled
- `packages/tools` - 5 modules compiled (includes new Handoff module)
- `packages/chorus` - 13 modules compiled (includes updated Registry)

## Test Status
**Status:** PASS

- Unit tests: 36 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes

- **HTTP via curl**: The handoff tool uses curl via `ChildProcess.run` because Gren's Node platform does not include an HTTP client. This matches the approach used by file tools for ripgrep and find.
- **Polling approach**: The tool uses `Process.sleep` for the poll interval delay, then fetches the task JSON via curl and checks whether `currentAgent` is null. This replicates the behavior of the original `handoff.sh`.
- **Default values for optional fields**: `baseUrl` defaults to `"http://localhost:8080"`, `pollIntervalMs` defaults to 5000, and `maxWaitMs` defaults to 600000. These match the original shell script's defaults (5s poll, 600s max wait). The defaults are applied in the JSON decoder, which is consistent with the task spec's note that these are documented, intentional defaults (acceptable per CODING_STANDARDS.md).
- **Error types**: Five distinct error variants cover the failure modes: `HttpError` (non-2xx response), `CurlFailed` (curl process error), `JsonParseError` (response parsing failure), `Timeout` (polling exceeded max wait), and `AgentConflict` (409 when agent already active). Each uses a record for structured data per coding standards.
- **Integration tests**: The handoff integration test scenarios cover JSON decoding validation (missing required fields) and the unknown tool error case. Tests that would require a running Chorus server are marked with notes explaining they expect curl failures. Full end-to-end handoff tests require a running Chorus instance.
- **Registry update**: The `scripts/agent/*` glob was removed from all five default agent configs since agent scripts are development utilities, not runtime tools.

## Iteration
1
