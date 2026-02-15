# Developer Report

## Task
Address review feedback from iteration 3: fix the blocking issue where early-exit errors in `dispatchPlanner` are silently dropped, and apply the suggestion to simplify the `alreadySubmitted` check.

## Files Modified
- `packages/chorus/src/Main.gren` - Fixed early-exit error handling in `dispatchPlanner`, simplified `alreadySubmitted` check, added `failPlannerEarly` and `isJust` helper functions

## Changes

### Blocking Issue: Early-exit errors in dispatchPlanner silently dropped

When `dispatchPlanner` exits early because the workspace config is missing or the system agent provider is not configured, the previous code emitted a `GotAgentComplete` message without registering an executor in `activeExecutors`. This meant `GotAgentComplete` would find no executor, log a warning, and return without failing the task -- leaving it stuck in Pending state with no error visible to the user.

**Fix (option b from review):** Replaced the `GotAgentComplete` emission in both early-exit paths with a direct call to a new `failPlannerEarly` helper function. This function:
- If the registry is available: calls `Api.requestUpdateStatus` to set the task to `Failed` with a descriptive error message, records a `PlanningFailed` event, logs the error, and broadcasts to WebSocket clients
- If the registry is unavailable: logs the error (this is a degenerate case where the app is not fully initialized)

This matches the error-handling pattern already used in `handlePlannerComplete` for the `PlannerExitError` and `PlannerOutputMissing` cases.

### Suggestion 1: Simplified alreadySubmitted check

Replaced the nested `when` expressions (which tested `Dict.get` then `executor.completionReport`) with a pipeline using `Maybe.andThen` and a new `isJust` helper:

```gren
alreadySubmitted =
    if toolName == "completion-report" then
        Dict.get (Id.taskIdToString taskId) model.activeExecutors
            |> Maybe.andThen .completionReport
            |> isJust
    else
        False
```

### Suggestion 2: Silently swallowed error in PlannerOutputSubmitted event recording

Not addressed in this iteration. The review noted this is non-blocking and follows the pre-existing convention used throughout the file (e.g., `ToolExecuted` event at line 1246, `dispatchPlanner` status update at line 2520). The review recommended addressing all instances of this pattern together in a future cleanup.

## Build Status
**Status:** PASS

## Test Status
**Status:** PASS

- 77 unit tests passed, 0 failed
- 19 integration tests passed, 0 failed

## Implementation Notes
- Used option (b) from the review suggestion: handle the error directly in `dispatchPlanner` rather than routing through `GotAgentComplete`. This is simpler since these are synchronous configuration checks, not asynchronous process completions.
- The `failPlannerEarly` helper follows the same pattern as `handlePlannerComplete`'s `PlannerExitError` branch, ensuring consistent error handling (fail task, record event, log error, broadcast).
- Added `isJust` helper at the bottom of Main.gren in the HELPERS section, since it's useful for the `alreadySubmitted` simplification and may be reused elsewhere.

## Iteration
4
