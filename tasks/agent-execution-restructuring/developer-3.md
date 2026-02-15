# Developer Report

## Task
Phase 3: Refactor Agent.Executor. Add the unified executor -- a tool-processing state machine that receives events from a Provider (via Main.gren routing) and processes tool calls identically regardless of source (CLI HTTP callback or API response).

## Files Modified
- `packages/chorus/src/Agent/Executor.gren` - Added unified executor types (`UnifiedConfig`, `UnifiedMsg`, `UnifiedModel`, `PendingTool`, `DeferredAction`, `UpdateEffect`), `unifiedInit`, and `unifiedUpdate` alongside the existing legacy executor code

## Build Status
**Status:** PASS

```
Success! Compiled 24 modules.
    Main --> build/chorus-tmp
```

## Test Status
**Status:** PASS

```
Running 77 tests...
77 passed, 0 failed
```

## Implementation Notes

### What was added

All new code was added alongside the existing legacy executor. No existing code was modified. The module's exposing list was extended with the new types and functions.

**New types:**

1. **`UnifiedConfig msg`** - Configuration record with two fields:
   - `executeTool`: A function that takes a structured tool call `{ id, name, input }` and a callback, returning a `Cmd msg`. This is how the executor dispatches tool execution (via `Web.ToolExecution.executeToolCall` in practice).
   - `toMsg`: Wraps `UnifiedMsg` into the parent's message type.

2. **`UnifiedMsg`** - Four variants matching the plan:
   - `ToolCallReceived { id, name, input }` - A tool call arrived from the Provider.
   - `ToolCallCompleted ToolExecution.ToolCallResult` - Tool execution finished.
   - `AgentCompleted String` - Conversation finished successfully.
   - `AgentFailed String` - Conversation errored.

3. **`UnifiedModel`** - Five-state model:
   - `Idle` - Executor created but no conversation started.
   - `Running { pendingToolCalls, completedResults, completionReport, plannerOutput }` - Processing tool calls.
   - `AwaitingDeferredAction DeferredAction` - A deferred result needs Main.gren intervention.
   - `ExecutorComplete { output }` - Conversation finished.
   - `ExecutorFailed { error }` - Conversation errored.

4. **`PendingTool`** - Record alias `{ id, name, input }` for tracking dispatched tool calls.

5. **`DeferredAction`** - Two variants:
   - `Handoff { agentName, prompt }` - Agent invoked the handoff tool.
   - `PlannerOutputReady PlannerOutput` - Planner invoked the planner-output tool.

6. **`UpdateEffect`** - Three variants:
   - `NoEffect` - No external action needed.
   - `DeliverToolResults (Array ToolResult)` - All pending tools done, Main.gren should call `provider.deliverToolResults`.
   - `DeferredActionRequired DeferredAction` - Main.gren must handle a deferred action.

**New functions:**

1. **`unifiedInit`** - Returns `Idle`.

2. **`unifiedUpdate`** - Pure state machine that processes `UnifiedMsg` and returns `{ model, cmd, effect }`:
   - `ToolCallReceived`: Adds to `pendingToolCalls`, dispatches via `config.executeTool`, transitions to `Running`.
   - `ToolCallCompleted`: Delegates to `handleToolCallCompleted` which inspects the `ApiResult`:
     - `DeferredHandoff` -> transitions to `AwaitingDeferredAction`, emits `DeferredActionRequired`.
     - `DeferredPlannerOutput` -> transitions to `AwaitingDeferredAction`, emits `DeferredActionRequired`.
     - `ApiSuccess` -> collects as `ToolResult`, stores completion report if tool name is `completion-report`, emits `DeliverToolResults` when all pending tools are done.
     - `ApiError` -> collects as error `ToolResult`, emits `DeliverToolResults` when all pending tools are done.
   - `AgentCompleted`: Transitions to `ExecutorComplete`.
   - `AgentFailed`: Transitions to `ExecutorFailed`.

### Design decisions

- **`UpdateEffect` as return value instead of commands:** The plan says the executor should "signal that results should be delivered to Provider." Rather than having the executor call provider functions directly (which would require it to know about providers), `unifiedUpdate` returns an `UpdateEffect` that tells Main.gren what to do. This keeps the executor provider-agnostic. Main.gren inspects the effect and calls the appropriate provider function.

- **`completedResults` cleared after delivery:** When all pending tool calls are done and `DeliverToolResults` is emitted, the model's `completedResults` is reset to `[]`. The delivered results are in the `UpdateEffect`, not stored on the model. This prevents stale results from accumulating across tool call batches.

- **Completion report parsed from `requestBody`:** When a `completion-report` tool succeeds, the executor parses the completion report from `toolCallResult.requestBody` using `ToolExecution.completionReportInputDecoder`. This reuses the existing decoder. The parse should always succeed since the tool already validated the input, but the `Err` branch preserves the existing `completionReport` rather than losing it.

- **Variant naming:** The plan specified `Complete` and `Failed` for the `UnifiedModel`, but these would conflict with the legacy `Model`'s `Complete` and `Failed` constructors (since Gren constructors are module-scoped). I named them `ExecutorComplete` and `ExecutorFailed` to avoid conflicts while keeping both models in the same module.

- **`plannerOutput` on `Running` state:** The plan shows `plannerOutput : Maybe PlannerOutput` on the `Running` record. This field is populated when a `DeferredPlannerOutput` result arrives, but the model immediately transitions to `AwaitingDeferredAction`. The field exists on `Running` for consistency with `completionReport` (which stays on `Running`) and could be useful if the executor needs to access it after returning from a deferred state in Phase 4.

### What is NOT changed
- No modifications to `Main.gren` (Phase 4)
- No modifications to provider implementations (Phase 6)
- No modifications to `Provider.gren` or `Web/ToolExecution.gren`
- All existing legacy executor code (`Model`, `Msg`, `Config`, `init`, `update`, `executeToolCall`, etc.) remains untouched

### New imports added to Executor.gren
- `Dict exposing (Dict)` - for `pendingToolCalls` dictionary
- `Types` - for `CompletionReport` and `PlannerOutput`
- `Web.Api as Api` - for pattern matching on `ApiResult` variants
- `Web.ToolExecution as ToolExecution` - for `ToolCallResult` type and `completionReportInputDecoder`

## Iteration
3
