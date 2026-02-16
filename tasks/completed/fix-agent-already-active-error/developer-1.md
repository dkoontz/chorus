# Developer Report

## Task
Embed agent identity into the `TaskStatus` type to fix the "Agent already active on task: task-validator" error. The root cause was that `currentAgent` was a separate `Maybe String` field on the Task record, maintained independently from `TaskStatus`. When status transitioned from `Planning` to `ReadyToStart`, nobody cleared `currentAgent`. The fix makes this bug structurally impossible: states where an agent is active carry the agent name as data; at-rest states don't. Transitioning to an at-rest state inherently drops the agent.

## Files Modified
- `packages/shared/Types.gren` - Added `AgentInfo` type alias, embedded it in `Planning`, `Active`, `Waiting` constructors, removed `currentAgent` field from task records, replaced `taskCurrentAgent` with status-derived implementation, removed `setCurrentAgent`, added `statusAgentName` helper, updated encode/decode for status and task types, updated `statusToString`, `statusFromString`, `statusEquals`
- `packages/chorus/src/Task/Registry.gren` - Removed `currentAgent` from `TaskSummary` type, task creation, registry index updates, summary encode/decode. Updated `getActiveTasks` to use `Active { agentName = "" }` placeholder for `statusEquals` matching
- `packages/chorus/src/Web/Api.gren` - Updated `startAgentOnTask` and `completeAgentOnTask` to derive agent from status via `statusAgentName` instead of reading `currentAgent` field, status transitions now carry `AgentInfo` directly, updated `requestSubmitAnswers` to use `Planning { agentName = "task-validator" }`, updated `requestUpdateStatus` to resolve agent info from current task status, updated `isValidTransition` patterns to wildcard agent data
- `packages/chorus/src/Main.gren` - Updated `spawnTaskValidator` to single `Registry.updateStatus` call with `Planning { agentName = "task-validator" }` (removed separate `setCurrentAgent`), updated `parseStatusBody` decoder to produce constructors with `AgentInfo`
- `packages/chorus/src/Web/ToolExecution.gren` - Moved `newStatus` computation inside `updateFn` closure, updated `Waiting` and `Active` to carry agent info, replaced `statusToString` call with inline pattern match for event data
- `packages/chorus-ui/src/View/Board.gren` - Updated column definitions to use placeholder `AgentInfo` for `statusEquals` filtering
- `packages/chorus-ui/src/View/TaskDetail.gren` - Updated pattern matches to use wildcards: `Planning _`, `Active _`, `Waiting _`
- `packages/chorus/tests/unit/RegistryTests.gren` - Removed `currentAgent` from all test task records, updated `Active` constructors to carry `AgentInfo`, removed `testSetCurrentAgentMutator` test, updated `testTaskCurrentAgentAccessor` to test derivation from status, added `testTaskCurrentAgentDerivedFromStatus` for at-rest statuses returning Nothing

## Build Status
**Status:** PASS

All three components (chorus-ui, tools, chorus) and distribution packaging built successfully.

## Test Status
**Status:** PASS

85 tests passed, 0 failed.

## Implementation Notes
- Used `AgentInfo` record alias (`{ agentName : String }`) instead of bare `String` for extensibility, as specified in the plan
- `statusEquals` compares constructors only (ignores agent data), so placeholder values like `Active { agentName = "" }` work for filtering/matching without needing the real agent name
- `statusFromString` (parses bare strings like "active" from query params) uses placeholder `AgentInfo { agentName = "" }` since bare strings cannot carry agent names; this is fine because these values are only used with `statusEquals` which ignores agent data
- Removed `setCurrentAgent` entirely rather than deprecating it, since the type system now makes it unnecessary and leaving it would invite misuse
- The fix for the original bug requires zero special-case code: `requestApplyPlan` transitions to `ReadyToStart` which structurally cannot carry an agent. The bug is fixed by the type change itself.

## Iteration
1
