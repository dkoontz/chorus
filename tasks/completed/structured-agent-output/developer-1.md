# Developer Report

## Task
Replaced fragile JSON-code-fence parsing of planner output with structured tool-based output. Introduced a `planner-output` tool, unified planner tracking in `activeExecutors`, added exactly-once semantics for tool submissions, and created a pure `Agent.Manager` module for testable business logic.

## Files Modified
- `packages/shared/Types.gren` - Added `PlannerOutput` type (`PlanOutput | QuestionsOutput | PlannerError`), `PlannerOutputSubmitted` event type, `encodePlannerOutput` encoder, `plannerOutputDecoder` decoder, exported `completionStatusDecoder`
- `packages/chorus/src/Web/Api.gren` - Added `DeferredPlannerOutput Types.PlannerOutput` variant to `ApiResult` type, handled in `sendApiResponse`
- `packages/chorus/src/Web/ToolExecution.gren` - Auto-granted `planner-output` tool alongside `completion-report`, added dispatch case and `dispatchPlannerOutput` function
- `packages/chorus/src/Agent/ToolContext.gren` - Updated filter to exclude `planner-output` from general tool context (has its own instructions)
- `packages/tools/src/Tools/Help.gren` - Added `plannerOutputHelpRecord` to `allToolHelp` array with required/optional parameter documentation
- `packages/chorus/src/Agent/Manager.gren` - **New file.** Pure business logic module with zero IO imports. Contains `AgentCompletionResult`, `PlannerCompletionResult`, `RetryContext` types and `processAgentCompletion`, `processPlannerCompletion`, `shouldRetry` functions
- `packages/chorus/src/Agent/Registry.gren` - Updated `taskValidatorInstructions` to reference `planner-output` tool instead of JSON code fence format
- `packages/chorus/src/Main.gren` - Major refactor:
  - Extended `ExecutorState` with `completionReport`, `plannerOutput`, `isSystemAgent`, `retryCount`, `sessionId` fields (replaced `completionReportReceived : Bool`)
  - Removed `GotPlannerComplete` from `Msg` type
  - Rewrote `GotAgentComplete` handler to dispatch to `handlePlannerComplete` or `handleUserAgentComplete` based on `executor.isSystemAgent`
  - Added `DeferredPlannerOutput` handling in `GotToolResult` with exactly-once enforcement
  - Added `DeferredPlannerOutput` case to all `ApiResult` pattern matches for exhaustiveness
  - Rewrote `dispatchPlanner` to return `{ model, command }`, register planner as active executor with `isSystemAgent=True`, set `currentAgent="task-validator"` on task, and emit `GotAgentComplete`
  - Added `handlePlannerComplete` function using `AgentManager.processPlannerCompletion`
  - Added `handleUserAgentComplete` function using `AgentManager.processAgentCompletion`
  - Removed old code: local `PlannerOutput` type, `parsePlannerOutput`, `extractJsonCodeFence`, `planResultDecoder`, `questionsResultDecoder`
  - Updated `GotPlanTaskResult` and `GotAnswersSubmitted` to handle new `dispatchPlanner` return type and `DeferredPlannerOutput` case
  - Updated completion-report tracking to decode and store `Maybe CompletionReport` with exactly-once semantics

## Build Status
**Status:** PASS

All components (UI, tools, chorus) compile successfully.

## Test Status
**Status:** PASS

77 unit tests passed, 19 integration tests passed.

## Implementation Notes
- The `dispatchPlanner` function was changed from returning `Cmd Msg` to returning `{ model : Model, command : Cmd Msg }` because it now needs to register the executor in `activeExecutors` on the model. Call sites in `GotPlanTaskResult` and `GotAnswersSubmitted` were updated accordingly.
- Retry logic for `PlannerOutputMissing` was simplified to immediate failure rather than attempting to re-spawn. True retry would require storing the original task description on the executor and re-running `dispatchPlanner`, which can be added in a future iteration if needed. The `retryCount`, `sessionId`, and retry infrastructure in `Agent.Manager` remain in place for future use.
- The completion-report decoder in the `GotToolResult` handler uses `Decode.maybe (Decode.field "blockedReason" Decode.string)` (field is optional) rather than `Types.completionReportDecoder` which uses `Decode.field "blockedReason" (Decode.maybe Decode.string)` (field required, value nullable). This is necessary because agent tool submissions may omit `blockedReason` entirely.
- The `completionStatusDecoder` was added to Types module exports to support the inline decoder in Main.gren.
- The `planner-output` tool follows the same deferred pattern as `DeferredHandoff`: the tool dispatch returns a deferred result that signals Main.gren to store the data on the executor, and the actual application happens when the process exits via `GotAgentComplete`.
- The planner-output instruction is appended to the system prompt in `dispatchPlanner` (similar to how completion-report instructions are appended in `buildAgentSpawn`), ensuring the planner always knows about the tool regardless of its base instructions.

## Iteration
1
