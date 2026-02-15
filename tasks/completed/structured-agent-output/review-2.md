# Code Review Report

## Summary

The iteration 2 changes correctly address both blocking issues from the previous review (duplicated completion report decoder and manual Task pattern match). The `completionReportInputDecoder` is now exported and reused, `Types.setCurrentAgent` replaces the manual pattern match, the local `completionStatusStringDecoder` was removed in favor of `Types.completionStatusDecoder`, and documentation was added to the executor state fields. One blocking issue remains around the incomplete exactly-once enforcement for `completion-report`.

## Issues Found

### BLOCKING Issues

#### Issue 1: completion-report exactly-once enforcement does not prevent duplicate side effects
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1243-1271
- **Category:** Correctness
- **Description:** The plan requires "Enforce exactly-once semantics on both `completion-report` and `planner-output` tools" and the acceptance criteria states "Second call to `planner-output` or `completion-report` for same task returns error." For `planner-output`, the enforcement is correct: the `DeferredPlannerOutput` handler checks `executor.plannerOutput` and returns a 409 CONFLICT error to the agent if already present (lines 1145-1150). However, for `completion-report`, the enforcement is incomplete. The completion-report tool is dispatched via `dispatchCompletionReport` in `ToolExecution.gren`, which writes to the task registry (updating task status, recording events) on every call. The handler then reaches the `_` catch-all branch in `GotToolResult`, where lines 1258-1261 only prevent re-storing the report on the executor state. The second call still succeeds from the agent's perspective and applies a second set of side effects (status update, event recording) to the task in the registry. To achieve true exactly-once semantics matching the planner-output pattern, the completion-report tool call should be checked against `executor.completionReport` *before* dispatching to `ToolExecution.gren`, returning a 409 error if already submitted.
- **Suggestion:** Add an exactly-once check in the `GotToolResult` handler (or in `requestExecuteTool`) before the tool is dispatched. When `toolName == "completion-report"`, look up the executor for the task and check `executor.completionReport`. If `Just _`, return an `ApiError` with 409 CONFLICT immediately without calling `dispatchTool`. This mirrors the pattern used for `planner-output` in the `DeferredPlannerOutput` branch. Alternatively, make `completion-report` return a `Deferred` variant like `planner-output` does, so the check and application both happen in Main.gren.

### Suggestions

#### Suggestion 1: `Result.toMaybe` silently discards decode errors when storing completion report
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1250-1253
- **Category:** Correctness
- **Description:** When a successful `completion-report` tool result reaches the `_` catch-all handler, the request body is decoded using `ToolExecution.completionReportInputDecoder |> Result.toMaybe`. If decoding fails, `maybeReport` becomes `Nothing`, and the executor's `completionReport` stays as `Nothing`. This means `processAgentCompletion` will produce `CompletedWithoutReport` rather than `CompletedWithReport`, even though the tool already returned success to the agent and applied the report to the task via the registry. In practice, this should not fail because `dispatchCompletionReport` already validated the same body, but using `Result.toMaybe` here violates the project's coding standard against silently discarding errors. If a decode mismatch were ever introduced (e.g., if the decoders diverged), the failure would be invisible.
- **Suggestion:** Consider logging a warning if decoding fails here, or use `Result.mapError` to capture the decode error and log it. For example: `|> Result.toMaybe` could be replaced with explicit error handling that logs the decode failure while still storing `Nothing` on the executor (since the tool already succeeded). This makes any future divergence immediately visible.

#### Suggestion 2: `ctx` construction is repeated across `handlePlannerComplete` and `handleUserAgentComplete`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** Multiple locations in `handlePlannerComplete` (around lines 2680, 2715, 2742, 2770) and `handleUserAgentComplete` (around lines 2883, 2944, 2977)
- **Category:** Duplication
- **Description:** Both `handlePlannerComplete` and `handleUserAgentComplete` construct the same `ctx` record (`{ registry = registry, filesystemPermission = model.filesystemPermission, secureContext = model.secureContext, registryRoot = registryRootPath model }`) multiple times within each function -- once per branch that needs the registry. This record construction is identical across all occurrences.
- **Suggestion:** Extract the ctx construction into a helper function (e.g., `makeRegistryContext : Model -> Registry -> { registry : Registry, ... }`) or construct it once at the top of each function, passing it into the branches. This would reduce repetition and make future changes to the context structure less error-prone.

#### Suggestion 3: `plannerOutputInstruction` duplicates guidance already in the task-validator instructions
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2484-2485
- **Category:** Duplication
- **Description:** The `plannerOutputInstruction` string appended to the system prompt in `dispatchPlanner` contains the same guidance about using the `planner-output` tool that is already present in `taskValidatorInstructions` in `Agent/Registry.gren`. The task-validator's instructions already say "You MUST submit your result using the planner-output tool" with the same format examples. Appending a second copy via `plannerOutputInstruction` means the agent receives the same instructions twice, which is redundant and increases prompt length.
- **Suggestion:** Since the task-validator instructions already contain comprehensive planner-output tool usage guidance (updated as part of this change), consider removing or substantially shortening the `plannerOutputInstruction` string. A brief reminder like "Remember: you must call the planner-output tool before finishing." would be sufficient if any reinforcement is deemed necessary.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The completion-report exactly-once enforcement (Blocking Issue 1) must be addressed. The current implementation prevents re-storing the report on the executor but does not prevent the second call from applying duplicate side effects (status changes, event records) in the registry. This directly contradicts the plan's acceptance criteria that a second call should return an error. The fix is straightforward: check `executor.completionReport` before dispatching the tool, mirroring the pattern already used for `planner-output`.
