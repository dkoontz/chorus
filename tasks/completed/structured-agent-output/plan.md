# Structured Agent Output via AgentManager

## Summary

Replace fragile JSON-code-fence parsing of planner output with structured tool-based output for both system and user agents, introducing a new `Agent.Manager` module that cleanly separates agent business logic from provider transport.

## Requirements

- Add a `planner-output` tool that the task-validator agent calls to submit structured results (plan, questions, or error)
- Move `PlannerOutput` type from Main.gren to shared Types with encoder/decoder
- Create an `Agent.Manager` module with pure functions for agent lifecycle decisions
- Unify planner tracking into the existing `activeExecutors` dict (no separate `GotPlannerComplete` path)
- Enforce exactly-once semantics on both `completion-report` and `planner-output` tools
- Add CLI retry logic when an agent exits without calling its required output tool
- Remove `parsePlannerOutput`, `extractJsonCodeFence`, and the `GotPlannerComplete` message variant

## Acceptance Criteria

- [ ] `npm run build:all` compiles without errors
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes
- [ ] Planning a task via the UI transitions through Pending -> Planning -> Planned (or AwaitingInput)
- [ ] Task history shows `planner_output_submitted` event after planning
- [ ] Second call to `planner-output` or `completion-report` for same task returns error
- [ ] Agent that exits without calling required output tool is retried (up to 2 retries)
- [ ] After max retries, task fails with descriptive error
- [ ] `GotPlannerComplete`, `parsePlannerOutput`, and `extractJsonCodeFence` are removed from Main.gren

## Out of Scope

- Changing the openai-compat provider to use tool-based output (API providers handle this differently)
- Modifying the chorus-ui frontend
- Adding retry logic for non-CLI providers

## Technical Context

### Files to Modify

- `packages/shared/Types.gren` - Add `PlannerOutput` type + encoder/decoder, add `PlannerOutputSubmitted` to EventType
- `packages/chorus/src/Agent/Manager.gren` - **NEW** - Agent lifecycle business logic (pure functions)
- `packages/chorus/src/Web/ToolExecution.gren` - Add `planner-output` dispatch + auto-grant
- `packages/chorus/src/Web/Api.gren` - Add `DeferredPlannerOutput` to `ApiResult`, update `sendApiResponse`
- `packages/chorus/src/Main.gren` - Extend ExecutorState, unify planner into activeExecutors, merge GotPlannerComplete into GotAgentComplete, add retry logic, wire DeferredPlannerOutput, use Agent.Manager functions
- `packages/chorus/src/Agent/ToolContext.gren` - Add planner-output tool description
- `packages/tools/src/Tools/Help.gren` - Add planner-output help entry
- `agents/task-validator.json` (workspace) - Update instructions to use tool instead of code fences

### Related Files (reference only)

- `packages/chorus/src/Provider/ClaudeCode.gren` - CLI provider spawn logic, session_id extraction
- `packages/chorus/src/Agent/Registry.gren` - Agent config loading, task-validator is registered here as internal agent
- `packages/chorus/src/Web/Router.gren` - HTTP routing (no changes needed)

### Patterns to Follow

- `DeferredHandoff` pattern in Api.gren/ToolExecution.gren for deferred tool results
- `completion-report` auto-grant in ToolExecution.gren line 99
- `completionReportInputDecoder` pattern in ToolExecution.gren for tool input decoding
- `toolHelpByName` lookup pattern in Tools/Help.gren

## Implementation Plan

### Phase 1: Types and planner-output tool

#### 1A. Add `PlannerOutput` type to `packages/shared/Types.gren`

Move the planner output type from Main.gren to shared Types (it's currently defined locally in Main.gren):

```gren
type PlannerOutput
    = PlanOutput PlanningFields
    | QuestionsOutput (Array String)
    | PlannerError String
```

Add encoder, decoder (discriminated on `"type"` field: `"plan"`, `"questions"`, `"error"`). Add `PlannerOutputSubmitted` to `EventType` with string mapping `"planner_output_submitted"`.

#### 1B. Add `planner-output` tool to `Web/ToolExecution.gren`

- Auto-grant alongside `completion-report` (line 99): `if toolName == "completion-report" || toolName == "planner-output"`
- Add `dispatchPlannerOutput` handler that decodes the request body as `PlannerOutput`
- Return a new `DeferredPlannerOutput PlannerOutput` variant on `ApiResult` (like how `handoff` returns `DeferredHandoff`). This signals Main.gren to store the structured data without applying it yet
- The agent receives a success response via chorus-tools
- **Note**: The planner agent is NOT given the `completion-report` tool. The `planner-output` tool serves the same purpose for the planner and is required instead.

#### 1C. Add `planner-output` tool description to `Agent/ToolContext.gren` and `Tools/Help.gren`

Add help text so the system prompt includes usage instructions. The task-validator's instructions (in the agent config JSON) should also be updated to reference the tool instead of code fences.

#### 1D. Wire `DeferredPlannerOutput` into `GotToolResult` in Main.gren

When `GotToolResult` receives `DeferredPlannerOutput`:
- Check `plannerOutput` on executor state - if `Just _`, return error to agent (exactly-once)
- Store the parsed `PlannerOutput` on executor state (`plannerOutput = Just output`)
- Return success response to agent
- Record `PlannerOutputSubmitted` event

### Phase 2: Unify planner into executor tracking

#### 2A. Extend `ExecutorState` in Main.gren

```gren
type alias ExecutorState =
    { taskId : TaskId
    , agentName : String
    , agentConfig : Types.AgentConfig
    , status : ExecutorStatus
    , completionReport : Maybe CompletionReport   -- CHANGED: was Bool, now stores data
    , plannerOutput : Maybe PlannerOutput          -- NEW: stored structured data
    , isSystemAgent : Bool                         -- NEW: planner vs user agent
    , retryCount : Int                             -- NEW: for CLI retry
    , sessionId : Maybe String                     -- NEW: for --resume on retry
    }
```

`Maybe` values replace boolean flags throughout - presence/absence of the value indicates whether the tool was called.

#### 2B. Track planner in `activeExecutors`

Refactor `dispatchPlanner` to:
1. Set `currentAgent = "task-validator"` on the task (needed for tool execution endpoint - currently fails with "No agent currently active on this task")
2. Register an `ExecutorState` with `isSystemAgent = True` in `activeExecutors`
3. Extract `session_id` from CLI batch JSON output and store on executor state
4. Emit `GotAgentComplete` instead of `GotPlannerComplete` when process exits

#### 2C. Merge `GotPlannerComplete` into `GotAgentComplete`

In `GotAgentComplete`, check `isSystemAgent` on the executor:
- `True` + `plannerOutput` is `Just`: use stored `PlannerOutput` to apply plan/set questions/fail (via `Agent.Manager.processPlannerCompletion`)
- `True` + `plannerOutput` is `Nothing`: trigger retry (Phase 5) or fail task if max retries exceeded
- `False` + `completionReport` is `Just`: use stored report (via `Agent.Manager.processAgentCompletion`)
- `False` + `completionReport` is `Nothing`: trigger retry or fail

Remove the `GotPlannerComplete` message variant, handler, `parsePlannerOutput`, and `extractJsonCodeFence` entirely.

### Phase 3: Create `Agent.Manager` module

**New file**: `packages/chorus/src/Agent/Manager.gren`

This module contains **zero imports** of provider, HTTP, process, or ChildProcess modules. It operates purely on typed data and returns decisions.

#### 3A. Agent completion processing

```gren
processAgentCompletion :
    { exitResult : Result String String
    , completionReport : Maybe CompletionReport
    }
    -> AgentCompletionResult

type AgentCompletionResult
    = CompletedWithReport CompletionReport
    | CompletedWithoutReport String          -- raw output text
    | AgentExitError String
```

#### 3B. Planner completion processing

```gren
processPlannerCompletion :
    { exitResult : Result String String
    , plannerOutput : Maybe PlannerOutput
    }
    -> PlannerCompletionResult

type PlannerCompletionResult
    = PlanReady PlanningFields
    | QuestionsReady (Array String)
    | PlannerExitError String
    | PlannerOutputMissing  -- signals retry needed
```

#### 3C. Retry decision

```gren
type alias RetryContext =
    { retryCount : Int
    , maxRetries : Int
    }

shouldRetry : RetryContext -> Bool
```

### Phase 4: Exactly-once enforcement

#### 4A. completion-report enforcement

In `GotToolResult`, before processing:
- Check `completionReport` on executor state (`Maybe CompletionReport`)
- If `Just _` (already present), return error response: `{"error": "Completion report already submitted"}`

#### 4B. planner-output enforcement

Same pattern in the new `DeferredPlannerOutput` handler:
- Check `plannerOutput` on executor state (`Maybe PlannerOutput`)
- If `Just _`, return error to agent

### Phase 5: CLI provider retry for missing output tool

#### 5A. Retry logic in `GotAgentComplete`

When process exits and expected output tool was NOT called (`plannerOutput == Nothing` or `completionReport == Nothing`):
- Call `Agent.Manager.shouldRetry` with current retry count (max 2 retries)
- If should retry:
  - Increment `retryCount` on executor state
  - Keep executor in `activeExecutors` (don't remove)
  - Build new CLI command with `--resume <sessionId>` and message: _"You must call the [planner-output|completion-report] tool before finishing. Please call it now."_
  - Spawn new process, which will emit another `GotAgentComplete`
- If max retries exceeded:
  - Set task to Failed with error message explaining the agent did not submit required output
  - No fallback to code-fence parsing or raw stdout - this is a hard failure

#### 5B. Session ID extraction

In the planner spawn handler, extract `session_id` from CLI batch JSON output:
```gren
Decode.decodeString (Decode.field "session_id" Decode.string) rawOutput
```
Store on `ExecutorState.sessionId` for use in retry.

For user agents spawned via `buildAgentSpawn`, similarly extract session_id from stdout on first run.

### Phase 6: Update task-validator agent config

Update `task-validator.json` instructions to reference the `planner-output` tool:

```
You MUST call the planner-output tool to submit your results.
For a plan: {"tool": "planner-output", "type": "plan", "summary": "...", "requirements": [...], "acceptanceCriteria": [...], "plan": [...], "assignedAgent": "..."}
For questions: {"tool": "planner-output", "type": "questions", "questions": [...]}
For errors: {"tool": "planner-output", "type": "error", "error": "..."}
```

## Testing Requirements

1. **Build**: `npm run build:all` compiles without errors
2. **Unit tests**: `npm run test:unit` passes
3. **Integration test - planner output tool**:
   - Start app, create task, click "Plan Task"
   - Verify task transitions: Pending -> Planning -> Planned (or AwaitingInput)
   - Check history shows `planner_output_submitted` event
4. **Integration test - retry**:
   - Temporarily break the task-validator instructions so it doesn't call the tool
   - Verify retry happens (check logs for resume attempt)
   - Verify task eventually fails after max retries
5. **Integration test - exactly-once**:
   - Verify second tool call returns error (can test via direct curl to /api/tasks/{id}/tools)
6. **Existing tests**: `npm run test` all pass (no regression)

## Notes

- The planner agent is NOT given the `completion-report` tool. The `planner-output` tool serves the same purpose for the planner.
- `Agent.Manager` is intentionally pure (no IO imports) to keep business logic testable and separate from transport.
- The `Maybe CompletionReport` / `Maybe PlannerOutput` on ExecutorState replaces boolean flags - presence/absence indicates whether the tool was called.
- Session ID extraction from CLI output enables `--resume` on retry.
- The task-validator config lives in the workspace (loaded at runtime from the agents directory), not in the source tree.
