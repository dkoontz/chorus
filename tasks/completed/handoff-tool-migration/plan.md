# Migrate Handoff from Agent Script to Gren Tool

## Summary

Move the handoff functionality from `scripts/agent/handoff.sh` (a shell script) into a proper Gren-based tool in `packages/tools/`, following the same patterns as the existing file tools. Update agent documentation to clarify the distinction between agent scripts (development utilities) and tools (runtime capabilities for Chorus-managed agents).

## Background

- `scripts/agent/handoff.sh` is a shell script that calls the Chorus API to start a handoff, then polls for completion
- Agent scripts in `scripts/agent/` are utility scripts for agents that are _developing_ the Chorus application (build, start, stop, test, etc.)
- Tools in `packages/tools/` are Gren-based CLIs for agents _running inside_ the completed Chorus application on other systems
- The handoff is an internal runtime capability, not a development utility - it belongs as a tool

## Requirements

1. Create a new handoff tool in `packages/tools/` written in Gren that performs the same function as `handoff.sh`: starts a handoff via the Chorus API and polls until the agent completes, returning the output
2. The tool should accept JSON input like the file tools: `{"tool":"handoff","taskId":"...","agentName":"...","prompt":"..."}`
3. The tool should use HTTP requests (via ChildProcess running curl, since Gren/Node doesn't have a built-in HTTP client) to call the Chorus API endpoints (`POST /api/tasks/:id/handoff` and `GET /api/tasks/:id`)
4. The tool should poll for completion and return the agent's output as JSON
5. Remove `scripts/agent/handoff.sh` since it no longer belongs there
6. Update the `allowedTools` in `Agent/Registry.gren` default configs to remove the `scripts/agent/*` glob pattern - replace with the tools binary reference
7. Update agent markdown files (`agents/developer.md`, `agents/orchestrator.md`, etc.) to clarify: scripts in `scripts/agent/` are for agents building the Chorus app itself; tools in `packages/tools/` are runtime capabilities available to Chorus-managed agents
8. Add the handoff tool to `Tools.Json` request decoder alongside the file tools
9. Add integration tests for the handoff tool following the same JSON scenario pattern used by file tool tests

## Acceptance Criteria

- [ ] A `handoff` tool request type exists in `Tools.Json.gren` and is handled in `Main.gren` of the tools package
- [ ] The handoff tool makes HTTP calls to the Chorus API to start a handoff and poll for completion
- [ ] The tool returns JSON output with the agent's response text or an error
- [ ] `scripts/agent/handoff.sh` is deleted
- [ ] Agent registry default configs no longer reference `scripts/agent/*`
- [ ] Agent markdown files include a note clarifying the difference between agent scripts and tools
- [ ] The tools package builds successfully with the handoff tool included
- [ ] Integration tests exist for the handoff tool

## Out of Scope

- Changing the Chorus server-side handoff API endpoints (they already work correctly)
- Modifying the UI components related to handoff
- Changing how the orchestrator agent invokes sub-agents (it uses Task tool/sub-agents directly, not the handoff tool)

## Files to Modify

- `packages/tools/src/Main.gren` - Add HandoffRequest handling to the tool dispatcher
- `packages/tools/src/Tools/Json.gren` - Add HandoffRequest type, decoder, and output encoder
- New file: `packages/tools/src/Tools/Handoff.gren` - Handoff logic (HTTP calls via curl, polling, response parsing)
- `packages/chorus/src/Agent/Registry.gren` - Update default `allowedTools` to remove `scripts/agent/*`
- `agents/developer.md` - Add clarification about agent scripts vs tools
- `agents/orchestrator.md` - Update sub-agent invocation docs if referencing handoff.sh
- `agents/developer-review.md` - Add clarification
- `agents/qa.md` - Add clarification
- `agents/planner.md` - Add clarification
- Delete: `scripts/agent/handoff.sh`

## Related Files (reference only)

- `packages/tools/src/Tools/File.gren` - Pattern to follow for tool implementation
- `packages/tools/src/Tools/Validation.gren` - Shows how workspace scoping works
- `packages/chorus/src/Web/Api.gren` - Server-side handoff API (requestStartHandoff, requestCompleteHandoff)
- `packages/chorus/src/Main.gren` - How the server handles handoff requests
- `scripts/agent/build.sh` - Example of a proper agent script (development utility)

## Patterns to Follow

- Tool request types in `Tools.Json.gren` follow the pattern: decoder maps `"tool"` field to a specific request type
- Tool implementations in separate modules (like `Tools.File`) expose input/output types and a main function
- Tools use `ChildProcess` for external command execution (e.g., ripgrep, find)
- JSON output follows `{key: value}` object format for success, or `{error: message}` for errors
- Integration tests use JSON scenario files in `tests/integration/`

## Technical Notes

- The handoff tool will use `curl` via `ChildProcess` since Gren's Node platform doesn't provide an HTTP client
- The polling interval and timeout should be configurable via the JSON input (with defaults matching the current `handoff.sh`: 5s interval, 600s max wait)
- The tool receives the base URL as an environment variable or argument (similar to how `workspace_root` is passed to file tools)

## Testing Requirements

- The handoff tool should be testable against a running Chorus instance
- Integration test scenarios should cover: successful handoff, agent not found, task not found, timeout
- Unit tests can cover the JSON parsing and response formatting
