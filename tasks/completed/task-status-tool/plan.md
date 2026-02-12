# Task: Create Task Status Tool

## Summary

Create a new tool that allows agents to query the status of a task in the Chorus system. This enables workflow orchestrators and other agents to look up the current state of a task, see which agent is working on it, review the handoff history, and check queued messages. The tool must follow the same patterns as existing tools and include help text for discoverability.

## Requirements

- Create a new `task-tools` binary in `packages/tools/` that provides task status commands
- Implement a `task.get` command that retrieves full task details from the Chorus API
- Implement a `task.list` command that lists tasks with optional status filtering
- Implement a `help` command that describes all available commands (following the pattern from the file-tools help task)
- The tool must query the Chorus HTTP API (same pattern as the handoff tool)

## Commands

| Command | Input | Output |
|---------|-------|--------|
| `task.get` | `{taskId}` | Full task data: status, currentAgent, agentChain, description, planning fields |
| `task.list` | `{status?}` | Array of task summaries: id, description, status, currentAgent |
| `help` | `{}` | Structured help describing all commands |

## Acceptance Criteria

- [ ] `task.get` returns the full task record including status, currentAgent, agentChain history, and planning fields
- [ ] `task.list` returns task summaries, optionally filtered by status
- [ ] `help` command returns structured JSON describing all available commands, parameters, and outputs
- [ ] The binary is built alongside existing tools in the build pipeline
- [ ] Error messages are clear and helpful for agents
- [ ] Integration tests verify each command
- [ ] The tool uses the same CLI pattern: `task-tools <json_input>`

## Technical Context

**New files:**
- `packages/tools/src/TaskToolsMain.gren` - Entry point for task-tools binary
- `packages/tools/src/Tools/TaskStatus.gren` - Implementation: HTTP calls to Chorus API
- `packages/tools/src/Tools/TaskJson.gren` - JSON encoding/decoding for task tool requests and responses

**Existing patterns to follow:**
- `packages/tools/src/HandoffMain.gren` - Similar CLI entry point pattern (ChildProcess only, no FileSystem)
- `packages/tools/src/Tools/Handoff.gren` - Similar HTTP-to-Chorus-API pattern using curl
- `packages/tools/src/Tools/Json.gren` - JSON encoding/decoding patterns

**API endpoints to use:**
- `GET /api/tasks/:id` - Get full task data (for `task.get`)
- `GET /api/tasks?status=...` - List tasks with optional filter (for `task.list`)

**Build integration:**
- Add build step to `packages/tools/package.json` for `task-tools` binary
- Same Gren → Bun binary pipeline as file-tools and handoff-tool

## Notes

- This tool does NOT need FileSystem permission - it only uses ChildProcess to call curl
- The `baseUrl` parameter should default to `http://localhost:8080` (same as handoff tool)
- No workspace root parameter needed since this tool doesn't do file operations
