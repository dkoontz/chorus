# Agent Hand-off Tracking

## Summary

Add agent hand-off tracking to the task data model, a `hand-off-to-agent` tool call mechanism, and the wiring to spawn agent sessions through the Chorus app. When an agent invokes `hand-off-to-agent <agent-name> <prompt>`, the app records the transition, spawns a new Claude CLI session for the target agent with that agent's permissions, captures the output, and returns only the final message to the calling agent.

## Requirements

### Part 1: Data model -- Hand-off tracking fields

- Add a `HandoffRecord` type alias to `Types.gren`:
  ```
  { agentName : String
  , startedAt : Time.Posix
  , completedAt : Maybe Time.Posix
  , output : String
  }
  ```
- Add `currentAgent : Maybe String` and `agentChain : Array HandoffRecord` fields to both `DescriptionOnlyTask` and `PlannedTask`
- Add accessors `taskCurrentAgent : Task -> Maybe String` and `taskAgentChain : Task -> Array HandoffRecord`
- Add mutator `setCurrentAgent : Maybe String -> Task -> Task`
- Encode `currentAgent` as a nullable string and `agentChain` as an array of objects with keys `"agentName"`, `"startedAt"`, `"completedAt"`, `"output"`
- Decode both fields directly (no backward-compatibility fallbacks needed -- there is no existing data)
- These fields are NOT added to `TaskSummary` in the registry index (they are only on the full task record). However, `currentAgent` should also be added to `TaskSummary` for the kanban board to display which agent is active without loading the full task -- this is the one exception
- Update `createTask` in `Task.Registry` to initialize `currentAgent = Nothing` and `agentChain = []`
- Update `planTask` in `Types.gren` to carry forward `currentAgent` and `agentChain` when converting from `DescriptionOnly` to `Planned`

### Part 2: Agent registry -- File-based agent config storage

- Add a new module `Agent.Registry` in `packages/chorus/src/Agent/Registry.gren`
- Define an `AgentConfig` type:
  ```
  { name : String
  , specPath : String          -- Path to the agent's markdown spec file (e.g., "agents/developer.md")
  , allowedTools : String      -- The --allowedTools value for this agent (e.g., "Bash(file-tools *)")
  , permissionMode : String    -- e.g., "bypassPermissions" or "default"
  }
  ```
  Note: there is no separate `tools` field. The `--tools` CLI flag value is derived from `allowedTools` at command-build time via `toolCliFlagFromAllowedTools` (see Part 4).
- Agent configs are stored as individual JSON files in `data/agents/{name}.json` (e.g., `data/agents/developer.json`). Example file:
  ```json
  {
    "name": "developer",
    "specPath": "agents/developer.md",
    "allowedTools": "Bash(file-tools *)",
    "permissionMode": "bypassPermissions"
  }
  ```
- No index file is needed -- agents are a small set and the directory can be read directly
- Provide the following functions:
  - `init : FileSystem.Permission -> { agentsRoot : String } -> GrenTask.Task Error AgentRegistry` -- creates `data/agents/` if missing, seeds default configs when the directory is empty
  - `getAgent : AgentRegistry -> String -> GrenTask.Task Error (Maybe AgentConfig)` -- reads `data/agents/{name}.json`
  - `listAgents : AgentRegistry -> GrenTask.Task Error (Array AgentConfig)` -- reads all `.json` files in `data/agents/`
- Define an `Error` type: `FileSystemError String | JsonDecodeError String | AgentNotFound String`
- On first run (empty `data/agents/` directory), seed default configs for the five known agents: `developer`, `developer-review`, `qa`, `planner`, `orchestrator`
- The spec file paths should be relative to the project root (e.g., `"agents/developer.md"`)
- Add read-only API endpoints for agent configs:
  - `GET /api/agents` -- list all agent configs
  - `GET /api/agents/:name` -- get a single agent config
- Add route variants to `Web.Router`:
  - `ListAgents` for `GET /api/agents`
  - `GetAgent String` for `GET /api/agents/:name`

### Part 3: Hand-off API endpoints

- Add a `POST /api/tasks/:id/handoff` endpoint:
  - Request body: `{ "agentName": "developer", "prompt": "Implement the feature described in..." }`
  - Sets `currentAgent` to the agent name on the task
  - Appends a new `HandoffRecord` to `agentChain` with `startedAt` set to now, `completedAt` as `Nothing`, and `output` as empty string
  - Records an `agent_handoff_started` event in the task history with data `{ "agentName": "developer" }`
  - Sets task status to `Active` if it was `Pending` or `Waiting`
  - Spawns the agent session (see Part 4)
  - Returns the updated task JSON immediately (does not wait for agent to complete)

- Add a `PUT /api/tasks/:id/handoff/complete` endpoint (called internally by the app when an agent finishes):
  - Request body: `{ "output": "..." }`
  - Sets `completedAt` on the last entry in `agentChain` to now
  - Sets `output` on the last entry to the provided output string
  - Clears `currentAgent` to `Nothing`
  - Sets task status to `Waiting` (ready for next input)
  - Records an `agent_handoff_completed` event in the task history with data `{ "agentName": "<name>", "outputLength": "<length>" }`
  - Returns the updated task JSON

- Add route variants to `Web.Router`:
  - `StartHandoff String` for `POST /api/tasks/:id/handoff`
  - `CompleteHandoff String` for `PUT /api/tasks/:id/handoff/complete`

### Part 4: Agent execution -- Wiring the executor into Main

This is the part that connects the existing `Agent.Executor` and `Provider.ClaudeCode` modules into the main app so agents can actually run.

- Import `Agent.Executor`, `Provider`, `Provider.ClaudeCode`, and `Agent.Registry` in `Main.gren`
- Add to the `Model`:
  - `activeExecutors : Dict String ExecutorState` -- keyed by task ID, tracks running agent sessions
  - `providerConfig : Provider.ClaudeCode.Config` -- initialized during `init`
  - `agentRegistry : Maybe Agent.Registry.AgentRegistry` -- initialized during `init` alongside the task registry
- Define an `ExecutorState` type in Main (or a new module):
  ```
  { taskId : String
  , agentName : String
  , agentConfig : Agent.Registry.AgentConfig
  , session : Maybe Provider.Session
  , status : ExecutorStatus  -- Starting | Running | Completed String | Failed String
  }
  ```
- When `POST /api/tasks/:id/handoff` is received:
  1. Look up the agent config via `Agent.Registry.getAgent agentRegistry agentName` (file-based lookup, returns a `GrenTask`)
  2. If not found, return a 400 error with `"Unknown agent: <name>"`
  3. Load the agent spec from the spec file path
  4. Create a Provider session using `Provider.ClaudeCode.provider` with the agent's tool/permission configuration
  5. Send the prompt as the first message
  6. Store the executor state in `activeExecutors`
  7. Return the updated task JSON to the caller
- When the CLI process completes (the `sendMessage` callback fires):
  1. Extract the final response text (this is the `result` field from the CLI JSON output -- what `parseCliResponse` returns as `response.text`)
  2. Call the internal `CompleteHandoff` endpoint logic to record the output
  3. Remove the executor from `activeExecutors`
  4. The output is now stored in the task's `agentChain` and available via `GET /api/tasks/:id`

- Update `Provider.ClaudeCode.buildShellCommand` (or create a variant) to accept configurable `--allowedTools` and `--permission-mode` values instead of the current hardcoded ones. The `--tools` flag value is derived from `allowedTools` via `toolCliFlagFromAllowedTools` (see below). The existing hardcoded values become the defaults if no override is provided.
- Add a `toolCliFlagFromAllowedTools : String -> String` function to `Provider.ClaudeCode` that extracts tool category names from an `allowedTools` string. For example, `"Bash(file-tools *) Edit Read(*)"` produces `"Bash Edit Read"`. This works by splitting on spaces, stripping any parenthesized qualifier from each token, and deduplicating.

### Part 5: Hand-off tool for agents

When an agent running inside a Claude CLI session wants to hand off to another agent, it needs a mechanism to do so. Since the Claude CLI runs `--tools Bash` and tools are Bash commands, the hand-off tool is a small CLI script or binary that makes an HTTP request to the Chorus API.

- Create a script `scripts/agent/handoff.sh` that:
  - Takes three arguments: `<task-id> <agent-name> <prompt>`
  - Makes a `POST` request to `http://localhost:8080/api/tasks/<task-id>/handoff` with the JSON body `{"agentName": "<agent-name>", "prompt": "<prompt>"}`
  - Waits for the agent to complete by polling `GET /api/tasks/<task-id>` until `currentAgent` is `null` (the hand-off completed)
  - Once complete, reads the last entry in `agentChain` and outputs its `output` field to stdout
  - This way, the calling agent receives the target agent's final message as the tool result

- Add `scripts/agent/handoff.sh` to the Bash permission allowlist in `.claude/settings.json`

- The polling approach means the calling agent's CLI process blocks on the Bash tool call until the target agent completes. This is the desired behavior -- the caller waits for the result.

### Part 6: Update agent specs for hand-off awareness

- Update agent spec markdown files to include a reference to the hand-off tool in their instructions. Each agent that can delegate work should know:
  - The tool is invoked as: `scripts/agent/handoff.sh <task-id> <agent-name> "<prompt>"`
  - The task ID is passed as a parameter when the agent is invoked
  - The output is the final message from the target agent
  - Available agent names: `developer`, `developer-review`, `qa`, `planner`

- Update `orchestrator.md` to use the hand-off mechanism instead of the Task tool sub-agent pattern. The orchestrator should invoke agents via `scripts/agent/handoff.sh` instead of spawning sub-agents.

### Part 7: Tests

- Add unit tests in `RegistryTests.gren` for:
  - Encode/decode round-trip with `currentAgent` and `agentChain` populated

  - `HandoffRecord` encode/decode round-trip
  - `taskCurrentAgent` and `taskAgentChain` accessors
  - `setCurrentAgent` mutator
  - `planTask` carries forward hand-off fields

## Acceptance Criteria

- [ ] `DescriptionOnlyTask` and `PlannedTask` both include `currentAgent : Maybe String` and `agentChain : Array HandoffRecord`
- [ ] `HandoffRecord` type alias exists with `agentName`, `startedAt`, `completedAt`, `output` fields
- [ ] `TaskSummary` includes `currentAgent : Maybe String` for kanban board display
- [ ] `Agent.Registry` module exists with file-based config storage in `data/agents/`
- [ ] `Agent.Registry.init` seeds default configs for all five agents when `data/agents/` is empty
- [ ] `Agent.Registry.getAgent registry "developer"` returns the developer config from `data/agents/developer.json`
- [ ] `Agent.Registry.getAgent registry "unknown"` returns `Nothing`
- [ ] `GET /api/agents` returns all agent configs
- [ ] `GET /api/agents/:name` returns a single agent config
- [ ] `POST /api/tasks/:id/handoff` with `{"agentName": "developer", "prompt": "..."}` sets `currentAgent`, appends to `agentChain`, and spawns the agent
- [ ] `PUT /api/tasks/:id/handoff/complete` with `{"output": "..."}` records the output and clears `currentAgent`
- [ ] The agent chain preserves all records (nothing is overwritten)
- [ ] `Provider.ClaudeCode` accepts configurable `allowedTools` and `permissionMode` settings per agent
- [ ] `toolCliFlagFromAllowedTools` correctly derives `--tools` flag from `allowedTools` string
- [ ] The agent session runs with the correct permissions from `AgentConfig`
- [ ] Only the final response text from the CLI is stored as the hand-off output (not intermediate tool calls)
- [ ] `scripts/agent/handoff.sh` exists, is executable, and correctly polls for completion
- [ ] The handoff script returns the target agent's final output to stdout
- [ ] History events `agent_handoff_started` and `agent_handoff_completed` are recorded
- [ ] Task status transitions to `Active` when a hand-off starts and `Waiting` when it completes
- [ ] Agent participation count can be derived from `Array.length (taskAgentChain task)`
- [ ] Unit tests verify encode/decode round-trips for hand-off fields
- [ ] `npm run build:all` completes without errors

## Out of Scope

- UI display of hand-off data on kanban board cards (tracked separately in `tasks/kanban-board-ui.md`)
- UI for editing agent configs (the file-based storage enables this in a future task)
- Create/update/delete API endpoints for agent configs (read-only for now)
- Concurrent agent execution on the same task (one agent at a time per task)
- Agent timeout or cancellation mechanisms
- Authentication or authorization for agent-to-agent calls (all agents run locally)
- Persistent agent session resumption across app restarts (sessions are ephemeral)
- Changes to the file-tools binary

## Technical Context

### Files to Create

- `packages/chorus/src/Agent/Registry.gren` -- File-based agent config storage (init, getAgent, listAgents)
- `scripts/agent/handoff.sh` -- CLI tool for agents to invoke hand-offs

### Files to Modify

**Shared types:**
- `packages/shared/Types.gren` -- Add `HandoffRecord`, add `currentAgent` and `agentChain` to both task variants, add encoders/decoders/accessors/mutators, update `planTask` to carry forward hand-off fields

**Backend:**
- `packages/chorus/src/Task/Registry.gren` -- Update `createTask` to initialize hand-off fields, update `TaskSummary` to include `currentAgent`, update summary encoder/decoder
- `packages/chorus/src/Web/Router.gren` -- Add `StartHandoff String`, `CompleteHandoff String`, `ListAgents`, and `GetAgent String` route variants, add route parsing, add `routeToString` entries
- `packages/chorus/src/Web/Api.gren` -- Add `requestStartHandoff`, `requestCompleteHandoff`, `requestAgents`, and `requestAgent` handlers, add `StartHandoffParams` and `CompleteHandoffParams` types
- `packages/chorus/src/Main.gren` -- Import executor/provider modules, add `activeExecutors`, `providerConfig`, and `agentRegistry` to Model, add Msg variants for executor lifecycle, add body parsers and route handling for hand-off and agent config endpoints, wire up agent spawn/complete flow, initialize `agentRegistry` during `init`
- `packages/chorus/src/Provider/ClaudeCode.gren` -- Make `buildShellCommand` accept configurable `--allowedTools` and `--permission-mode` values. Add `toolCliFlagFromAllowedTools` to derive `--tools` from `allowedTools`. Update `CliArgs` to accept these overrides.

**Agent specs:**
- `agents/orchestrator.md` -- Update to use `scripts/agent/handoff.sh` instead of Task tool sub-agents
- `agents/developer.md` -- Add hand-off tool reference
- `agents/developer-review.md` -- Add hand-off tool reference
- `agents/qa.md` -- Add hand-off tool reference

**Config:**
- `.claude/settings.json` -- Add `scripts/agent/handoff.sh` to permission allowlist

**Tests:**
- `packages/chorus/tests/unit/RegistryTests.gren` -- Add encode/decode tests for hand-off fields, backward compatibility tests

### Related Files (reference only)

- `packages/chorus/src/Agent/Executor.gren` -- Existing executor module with conversation loop state machine (may need updates or may be superseded by the simpler single-shot approach in ClaudeCode provider)
- `packages/chorus/src/Agent/Spec.gren` -- Agent spec parser (unchanged, used by Agent.Registry to load specs)
- `packages/chorus/src/Provider.gren` -- Provider interface definition (unchanged)
- `packages/tools/src/Main.gren` -- File tools binary pattern (reference for how tools accept JSON input)
- `tasks/kanban-board-ui.md` -- Downstream consumer of `currentAgent` data for card display
- `data/registry/*/task.json` -- Existing task files that must remain decodable
- `data/agents/` -- Agent config storage directory (created by `Agent.Registry.init`)

### Patterns to Follow

- Gren uses `when ... is` for pattern matching (not `case ... of`)
- Record updates: `{ model | field = value }`
- JSON encoding uses `Encode.object [ { key = "...", value = ... } ]`
- JSON decoding uses `Decode.field "key" decoder` and `Decode.mapN` combinators
- Use `Decode.oneOf` with a fallback for backward-compatible decoding of optional fields
- Use `Decode.andThen` to decode beyond 8 fields (the existing decoders already use this pipeline pattern)
- API handlers follow: `requestXxx : ApiContext -> ... -> (ApiResult -> msg) -> Cmd msg`
- Routes are union type variants in `Web.Router.Route`
- Atomic file writes use `writeFileAtomic`
- Response wrapping uses `wrapResponse` for `{ data: ..., meta: { timestamp: ... } }` format
- History events use `Registry.recordEvent` with `{ eventType, data }` where `data` is `Dict String String`
- Task accessors follow the pattern of matching on both `DescriptionOnly t` and `Planned t` variants
- Agent scripts use `#!/usr/bin/env bash`, `set -e`, and resolve project root from script location
- The `Provider.ClaudeCode` module spawns `claude -p --output-format json` with `bash -c` and `</dev/null` stdin redirect
- The CLI returns a JSON object with `{ type: "result", is_error: bool, result: string, session_id: string }` -- the `result` field is the final text response

## Testing Requirements

- Unit test: `testHandoffRecordEncodeDecode` -- create a HandoffRecord, encode, decode, verify all fields match
- Unit test: `testTaskWithHandoffFieldsEncodeDecode` -- create a task with populated `currentAgent` and `agentChain`, encode, decode, verify
- Unit test: `testPlanTaskCarriesHandoffFields` -- create a DescriptionOnly task with hand-off data, call `planTask`, verify hand-off fields are preserved on the Planned task
- Unit test: `testTaskSummaryIncludesCurrentAgent` -- create a task summary with `currentAgent` set, encode, decode, verify
- Manual test: start the app, create a task, call `POST /api/tasks/:id/handoff` with a valid agent name, verify `currentAgent` is set and `agentChain` has one entry
- Manual test: call `PUT /api/tasks/:id/handoff/complete` with output, verify `currentAgent` is cleared and the chain entry has output
- Manual test: run `scripts/agent/handoff.sh <task-id> developer "Hello"` and verify it spawns the agent, waits, and returns output
- Build test: `npm run build:all` completes without errors
- All existing tests pass after the changes

## Notes

- The `Agent.Executor` module exists in the codebase but is NOT currently imported or used by `Main.gren`. The main app currently only serves the REST API and static files. This task wires up agent execution for the first time. The `Agent.Executor` module's state machine (Loading -> Validating -> WaitingForSession -> Active -> Complete) may be useful as a reference, but the actual execution flow for hand-offs is simpler: the `Provider.ClaudeCode.sendMessage` function spawns a CLI process, waits for it to complete, and returns the result. There is no multi-turn tool loop because the CLI handles tools internally.

- The `Provider.ClaudeCode` module currently hardcodes `--tools Bash --allowedTools "Bash(file-tools *)" --permission-mode bypassPermissions`. For agent hand-offs, each agent needs different permissions. The `AgentConfig` in `Agent.Registry` provides per-agent `allowedTools` and `permissionMode` values. The `--tools` flag is derived from `allowedTools` via `toolCliFlagFromAllowedTools`, which extracts tool category names by stripping parenthesized qualifiers (e.g., `"Bash(file-tools *)"` → `"Bash"`). The `CliArgs` type (or a new variant) needs to accept the configurable `allowedTools` and `permissionMode`.

- The hand-off script (`scripts/agent/handoff.sh`) uses HTTP polling because the Chorus app is a simple HTTP server with no WebSocket or long-polling support. The script polls `GET /api/tasks/:id` every few seconds and checks whether `currentAgent` has been cleared. This is adequate for agent runs that take seconds to minutes.

- Only one agent can be active on a task at a time. If `POST /api/tasks/:id/handoff` is called while `currentAgent` is already set, the endpoint should return a 409 Conflict error.

- The `currentAgent` field is added to `TaskSummary` (the registry index) as an exception to the pattern where detailed fields only exist on the full task. This is because the kanban board needs to show which agent is active without loading every task's full JSON. The `agentChain` remains on the full task only.

- The `agentChain` stores all hand-off records, including completed ones. The count of unique agent names or total hand-offs can be derived from this array. The kanban board can display `Array.length agentChain` to indicate how many times the task has been passed between agents.

- Task status transitions: `Pending` -> `Active` (first hand-off) -> `Waiting` (agent completes) -> `Active` (next hand-off) -> etc. The `Completed` and `Failed` statuses are set by other means (e.g., the orchestrator decides the task is done).
