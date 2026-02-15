# Developer Report

## Task
Address review feedback from iteration 2: fix completion-report exactly-once enforcement to prevent duplicate side effects, and address three non-blocking suggestions.

## Files Modified
- `packages/chorus/src/Main.gren` - Added pre-dispatch exactly-once check for completion-report in GotToolAgentLookup handler; replaced `Result.toMaybe` with explicit decode error handling in GotToolResult; extracted `makeApiContext` helper to eliminate repeated ApiContext record construction; shortened `plannerOutputInstruction` to a brief reminder since the task-validator instructions already contain comprehensive guidance.

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

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes

### Blocking Issue Fix: completion-report exactly-once enforcement

The review correctly identified that the completion-report tool was not fully enforcing exactly-once semantics. Unlike `planner-output` (which returns a `DeferredPlannerOutput` variant handled in Main.gren before any side effects), `completion-report` was dispatched through `dispatchCompletionReport` in `ToolExecution.gren`, which directly applies registry side effects (task status updates, event recording) on every call. The existing guard in `GotToolResult` only prevented re-storing the report on the executor state, but the duplicate side effects had already occurred.

**Fix**: Added a pre-dispatch check in the `GotToolAgentLookup` handler. Before calling `ToolExecution.requestExecuteTool`, when `toolName == "completion-report"`, the code now looks up the executor for the task and checks `executor.completionReport`. If already `Just _`, it returns a 409 CONFLICT error immediately via `Api.sendApiResponse`, matching the pattern used for `planner-output` enforcement. The tool dispatch is never reached, so no duplicate side effects occur.

The redundant guard in the `GotToolResult` catch-all handler was also removed since the duplicate call can no longer reach that point.

### Suggestion 1: Replace Result.toMaybe with explicit error handling

Replaced `Result.toMaybe` in the completion-report decode path within `GotToolResult` with explicit pattern matching on `Ok report` / `Err _`. Although a decode failure should never happen here (since `dispatchCompletionReport` already validated the same body), the explicit handling avoids silently discarding errors per the coding standards.

### Suggestion 2: Extract ctx construction into helper

Created a `makeApiContext : Model -> Registry.Registry -> Api.ApiContext` helper function and replaced all repeated `{ registry = registry, filesystemPermission = model.filesystemPermission, secureContext = model.secureContext, registryRoot = registryRootPath model }` constructions across `handlePlannerComplete`, `handleUserAgentComplete`, `GotAgentLookup`, and the API route handler. This eliminated 9 identical record constructions.

### Suggestion 3: Reduce plannerOutputInstruction duplication

Shortened the `plannerOutputInstruction` string from a detailed format description (duplicating what's already in `taskValidatorInstructions` in `Agent/Registry.gren`) to a brief reminder: `"Remember: you must call the planner-output tool before finishing."` The comprehensive format examples and guidelines are already provided in the task-validator's instructions.

## Iteration
3
