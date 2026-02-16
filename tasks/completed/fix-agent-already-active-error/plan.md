# Fix: Embed agent identity in TaskStatus type

## Problem

After the task-validator finishes, clicking "Start Task" returns `Agent already active on task: task-validator`. The root cause is that `currentAgent` is a separate `Maybe String` field on the Task record, maintained independently from `TaskStatus`. When the status transitions from `Planning` → `ReadyToStart`, nobody clears `currentAgent`.

## Approach

Instead of patching the symptom, make the bug **structurally impossible** by embedding agent identity into the `TaskStatus` type itself. States where an agent is active carry the agent name; at-rest states don't. Transitioning to an at-rest state inherently drops the agent — no cleanup needed.

## New TaskStatus Type

```gren
type alias AgentInfo =
    { agentName : String
    }

type TaskStatus
    = Pending
    | Planning AgentInfo    -- agent doing the planning
    | AwaitingInput         -- questions returned, awaiting user answers
    | ReadyToStart          -- plan complete, at rest, ready for agent
    | Active AgentInfo      -- agent currently executing
    | Waiting AgentInfo     -- agent paused between turns (preserved for resume/handoff)
    | Completed
    | Failed String         -- error message
```

Using a record `{ agentName : String }` instead of a bare `String` makes it extensible — additional agent-related fields (e.g., sessionId) can be added later without changing every pattern match.

**Invariants enforced by the type:**
- `Planning info` → agent MUST exist during planning
- `ReadyToStart` → NO agent (at rest) — this is where the original bug lived
- `Active info` → agent MUST exist during execution
- `Waiting info` → agent preserved for handoff chain / resume
- `Pending`, `AwaitingInput`, `Completed` → NO agent possible

## Changes Required

### 1. `packages/shared/Types.gren` — Type definitions and helpers

**Add `AgentInfo` type alias**: `type alias AgentInfo = { agentName : String }`

**TaskStatus type** (line 237): Add `AgentInfo` parameter to `Planning`, `Active`, `Waiting`

**Remove `currentAgent` field** from both `DescriptionOnlyTask` (line 170) and `PlannedTask` (line 194)

**Replace `taskCurrentAgent`** (line 500): Derive from status instead of reading a field:
```gren
taskCurrentAgent : Task -> Maybe String
taskCurrentAgent task =
    when taskStatus task is
        Planning info -> Just info.agentName
        Active info -> Just info.agentName
        Waiting info -> Just info.agentName
        _ -> Nothing
```

**Remove `setCurrentAgent`** (line 626): No longer needed — agent is set by transitioning status.

**Add `statusAgentName` helper** for extracting agent from status directly:
```gren
statusAgentName : TaskStatus -> Maybe String
statusAgentName status =
    when status is
        Planning info -> Just info.agentName
        Active info -> Just info.agentName
        Waiting info -> Just info.agentName
        _ -> Nothing
```

**Update `encodeStatus`** (line 837): Encode agent name for `Planning`, `Active`, `Waiting`:
```json
{"type": "planning", "agent": "task-validator"}
{"type": "active", "agent": "developer"}
{"type": "waiting", "agent": "developer"}
```

**Update `statusDecoder`** (line 1222): Decode agent name for those variants.

**Update `statusToString`** (line 1625): `Planning _ -> "planning"`, `Active _ -> "active"`, `Waiting _ -> "waiting"` (string representation stays the same, agent is separate).

**Update `statusEquals`** (line 1850): Compare constructors ignoring agent data: `{ a = Active _, b = Active _ } -> True`.

**Update `parseStatus`** (line 1656): This parses bare strings like "active" — it can't carry agent names. Used for query params. Return constructor with placeholder: `Planning { agentName = "" }` or handle differently.

**Remove `currentAgent` from encode/decode** of both task variants (lines 719, 734, 993, 1047).

### 2. `packages/chorus/src/Task/Registry.gren` — Storage

**`TaskSummary`** (line 541): Remove `currentAgent` field. Derive from `status` field when needed.

**`createTask`** (line 217): Remove `currentAgent = Nothing` from record.

**`createTaskFromFile`** (line 283): Same.

**`updateRegistryIndex`** (line 398): Remove `currentAgent = Types.taskCurrentAgent updatedTask` from summary update.

**`encodeSummary`** (line 622): Remove `currentAgent` encoding.

**`decodeSummary`** (line 643): Remove `currentAgent` decoding.

### 3. `packages/chorus/src/Web/Api.gren` — API logic

**`startAgentOnTask`** (line 1012):
- Replace `existingAgent = Types.taskCurrentAgent task` with `existingAgent = Types.statusAgentName (Types.taskStatus task)`
- Replace `Types.setCurrentAgent (Just params.agentName)` with status transitions that carry the agent info:
  - `ReadyToStart -> Active { agentName = params.agentName }`
  - `Waiting _ -> Active { agentName = params.agentName }`
  - Other statuses: carry the agent info into the new `Active` status

**`completeAgentOnTask`** (line 1150):
- Replace `Types.taskCurrentAgent task` with `Types.statusAgentName (Types.taskStatus task)` to get agent name
- Replace `Types.setCurrentAgent parentAgent` with setting status to `Waiting { agentName = parentAgentName }` (if parent exists) or appropriate at-rest transition
- `Types.setTaskStatus Waiting` → `Types.setTaskStatus (Waiting { agentName = parentAgentName })` where parentAgentName comes from `findParentAgent`

**`requestApplyPlan`** (line 378): `Types.setTaskStatus Types.ReadyToStart` — no change needed, transitioning to `ReadyToStart` inherently drops the agent. **This is the fix for the original bug.**

**`requestSetQuestions`** (line 437): `Types.setTaskStatus Types.AwaitingInput` — same, inherently drops agent.

**`requestSubmitAnswers`** (line 605): `Types.setTaskStatus Types.Planning` → needs to know which agent will do the re-planning. Use `Planning { agentName = "task-validator" }` or pass the agent name through.

**`isValidTransition`** (line 1788): Update pattern matches to use wildcard for agent info: `{ from = Active _, to = Waiting _ }`, etc.

### 4. `packages/chorus/src/Main.gren` — Orchestration

**`spawnTaskValidator`** (line 3018-3023): Replace:
```gren
Types.setTaskStatus Types.Planning
...
Types.setCurrentAgent (Just "task-validator")
```
With:
```gren
Types.setTaskStatus (Types.Planning { agentName = "task-validator" })
```
Single operation — clean.

**Status string decoders** (lines 2276-2325): Update to decode agent name from status objects.

**`handlePlannerComplete`**: No changes needed for the original bug — `requestApplyPlan` transitions to `ReadyToStart` which carries no agent. The bug is fixed by the type change itself.

**Tool lookup** (line 1902): Replace `Types.taskCurrentAgent task` with `Types.taskCurrentAgent task` (function still exists, just re-implemented).

### 5. `packages/chorus/src/Web/ToolExecution.gren` — Tool dispatch

**Line 390**: Replace `Types.taskCurrentAgent task` with the new derived version (same function name, new implementation).

**Line 413**: `Types.setTaskStatus Types.Active` → `Types.setTaskStatus (Types.Active { agentName = agentName })` — needs agent name from context.

### 6. `packages/chorus-ui/src/View/Board.gren` — UI columns

**Line 29-32**: Update constructor references in column definitions:
- `Planning` → `Planning ""` or use a helper that matches on constructor regardless of data
- Actually, the board uses these for `statusEquals` filtering, so the wildcard equality check in `statusEquals` handles this.

**Line 139** (`viewCurrentAgent`): Replace `Types.taskCurrentAgent task` — same function, new implementation.

### 7. `packages/chorus-ui/src/View/TaskDetail.gren` — UI detail view

**Line 148-175**: Update pattern matches:
- `Planning` → `Planning _`
- `Active` → `Active _`
- `ReadyToStart` remains unchanged

### 8. `packages/chorus/tests/unit/RegistryTests.gren` — Tests

- Remove `currentAgent` from test task records
- Remove tests for `setCurrentAgent` / `taskCurrentAgent` field access
- Add tests for `taskCurrentAgent` derived from status
- Update status construction in tests: `Active` → `Active { agentName = "agent-name" }`, etc.

## Why This Fixes the Bug

Currently: `Planning` (status) + `currentAgent = Just "task-validator"` (field) → transition to `ReadyToStart` (status) but `currentAgent` stays `Just "task-validator"` (field forgotten).

After: `Planning { agentName = "task-validator" }` (status) → transition to `ReadyToStart` (status). There is no separate field to forget. The agent info is gone because `ReadyToStart` doesn't carry any.

## Acceptance Criteria

- After task-validator completes planning → status is `ReadyToStart`, `taskCurrentAgent` returns `Nothing`, "Start Task" works
- After task-validator returns questions → status is `AwaitingInput`, `taskCurrentAgent` returns `Nothing`
- Active agents → `taskCurrentAgent` returns `Just agentName` (derived from `Active agentName` status)
- Waiting agents → `taskCurrentAgent` returns `Just agentName` (preserved for handoff chain)
- All existing tests pass (updated for new type)
- Build succeeds
