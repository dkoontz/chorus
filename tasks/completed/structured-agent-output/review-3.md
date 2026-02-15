# Code Review Report

## Summary

The iteration 3 changes correctly address the blocking issue from the previous review (completion-report exactly-once enforcement) and all three suggestions. The pre-dispatch check in `GotToolAgentLookup` now prevents duplicate `completion-report` side effects, `Result.toMaybe` is replaced with explicit pattern matching, the `makeApiContext` helper eliminates nine duplicate record constructions, and `plannerOutputInstruction` is shortened to a brief reminder. One new blocking issue was found: the early-exit paths in `dispatchPlanner` silently drop errors instead of failing the task.

## Issues Found

### BLOCKING Issues

#### Issue 1: Early-exit errors in dispatchPlanner are silently dropped
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2469-2484
- **Category:** Correctness
- **Description:** When `dispatchPlanner` exits early because the workspace config is not loaded (line 2471) or the system agent provider is not configured (line 2480), it emits a `GotAgentComplete` message with an `Err` result but does NOT register an executor in `activeExecutors`. When `GotAgentComplete` fires (line 1015), it looks up `maybeExecutor`, finds `Nothing`, logs a warning ("GotAgentComplete for unknown executor"), and returns without failing the task. The task remains in its current state (Pending) with no visible error surfaced to the user. In the old code, `GotPlannerComplete` handled these errors by calling `Api.requestUpdateStatus` to set the task to `Failed` with a descriptive error message. This is a regression: previously, configuration errors during planning produced a visible task failure; now they are silently swallowed.
- **Suggestion:** Either: (a) register a minimal executor in `activeExecutors` for the early-exit paths so that `GotAgentComplete` can find it and route to `handlePlannerComplete`, which will produce `PlannerExitError` and fail the task properly; or (b) handle the error directly in `dispatchPlanner` for these early-exit paths instead of emitting `GotAgentComplete` -- for example, return a command that calls `Api.requestUpdateStatus` to set the task to `Failed` immediately, bypassing the executor lookup entirely. Option (b) is simpler since these are synchronous configuration checks, not asynchronous process completions.

### Suggestions

#### Suggestion 1: alreadySubmitted check can be simplified
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 809-827
- **Category:** Simplification
- **Description:** The `alreadySubmitted` variable uses nested `when` expressions to check whether a completion report has already been stored on the executor. The inner `when executor.completionReport is Just _ -> True; Nothing -> False` is equivalent to checking whether the value is `Just`. This entire block could be expressed more concisely using `Maybe.map` and `Maybe.withDefault`, or simply by testing `executor.completionReport /= Nothing` (if Gren supports this) or by using a helper like `isJust`. The current formulation is correct but verbose for what is essentially a boolean check on a `Maybe` value.
- **Suggestion:** Consider simplifying to something like:
  ```gren
  alreadySubmitted =
      if toolName == "completion-report" then
          Dict.get (Id.taskIdToString taskId) model.activeExecutors
              |> Maybe.andThen .completionReport
              |> (\m -> when m is Just _ -> True; Nothing -> False)
      else
          False
  ```
  Or extract a small helper `isJust : Maybe a -> Bool` if the pattern recurs.

#### Suggestion 2: Silently swallowed error in PlannerOutputSubmitted event recording
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1190
- **Category:** Correctness
- **Description:** The `recordEventCmd` for the `PlannerOutputSubmitted` event uses `GrenTask.onError (\_ -> GrenTask.succeed {})`, which silently discards any error from `Registry.recordEvent`. While this matches the existing pattern used elsewhere in the codebase (e.g., the `ToolExecuted` event at line 1246 and the `dispatchPlanner` status update at line 2520), the project's coding standard "Do Not Silently Swallow Errors in Tasks" explicitly discourages this pattern. A failure to record the event would be invisible in logs and data. This is not blocking because it follows the pre-existing convention in the file, but future cleanup should address all instances of this pattern together.
- **Suggestion:** Consider logging the error before discarding it, or propagating it so the caller can decide how to respond. This applies to all instances of this pattern, not just the new one.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The early-exit error handling regression in `dispatchPlanner` (Blocking Issue 1) must be addressed. When the workspace config is missing or the system agent provider is not configured, the task must be failed with a descriptive error rather than silently remaining in Pending state. The fix is straightforward: either register an executor for the early-exit paths or handle the failure directly in `dispatchPlanner` without routing through `GotAgentComplete`.
