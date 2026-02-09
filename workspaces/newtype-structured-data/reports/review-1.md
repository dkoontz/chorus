# Code Review Report

## Summary

The implementation introduces opaque `TaskId`, `SessionId`, and `MessageId` newtypes in a shared `Id` module, renames `agentWorkspace` to `workspacePath`, updates `Executor.Config` to use `Path`, and consistently updates encoders/decoders, function signatures, and tests across the codebase. The changes are well-structured and follow the coding standards. A few issues were found, one blocking.

## Issues Found

### BLOCKING Issues

#### Issue 1: `Debug.todo` in production code path (`Task.Queue.enqueue`)
- **File:** `packages/chorus/src/Task/Queue.gren`
- **Line:** 82
- **Category:** Correctness
- **Description:** The `enqueue` function uses `Debug.todo "Generated UUID was empty"` in the `Nothing` branch of `Id.messageIdFromString`. While the developer report acknowledges `Debug.todo` in test helpers as acceptable, this instance is in production code, not test code. `Debug.todo` will crash the program at runtime. The `Registry.createTask` function in `packages/chorus/src/Task/Registry.gren` (line 185-188) handles the same scenario correctly by returning `GrenTask.fail (FileSystemError "Generated UUID was empty")` when `Id.taskIdFromString` returns `Nothing`. The `Queue.enqueue` function should follow the same pattern and return a `GrenTask.fail` instead of crashing.
- **Suggestion:** Replace the `Debug.todo` with a `GrenTask.fail` that propagates the error. For example, after the UUID generation task, chain an `andThen` that converts `Nothing` to `GrenTask.fail (FileSystemError "Generated UUID was empty")` and `Just mid` to `GrenTask.succeed mid`, similar to how `Registry.createTask` handles it.

### Suggestions

#### Suggestion 1: `Task.Queue.TaskNotFound` still uses `String` instead of `TaskId`
- **File:** `packages/chorus/src/Task/Queue.gren`
- **Line:** 49
- **Category:** Style
- **Description:** The `Queue.Error` type has `TaskNotFound String` while `Registry.Error` was updated to `TaskNotFound TaskId` per the task specification (which explicitly states "The `Registry.Error` type has `TaskNotFound String` -- this should become `TaskNotFound TaskId`"). The `Queue.Error` type was not mentioned in the task spec as needing the same change, and the `Queue.TaskNotFound` variant does not appear to be constructed anywhere in the current code, so this is not blocking. However, for consistency with `Registry.Error`, it would be reasonable to update it to `TaskNotFound TaskId` (or remove the variant if it is truly unused).
- **Suggestion:** Consider updating `Queue.Error`'s `TaskNotFound` to use `TaskId` for consistency with `Registry.Error`, or remove it if unused.

#### Suggestion 2: `Queue.enqueue` accepts `taskId` as `String` parameter
- **File:** `packages/chorus/src/Task/Queue.gren`
- **Line:** 65
- **Category:** Naming
- **Description:** The `enqueue` function signature still accepts `taskId` as a `String` (the 4th parameter). The caller in `Web/Api.gren` line 403 passes `taskIdStr` (converted via `Id.taskIdToString`) so this works, but it means the queue module has an inconsistent interface compared to `Registry` where all functions accept `TaskId`. Since the `taskId` parameter in `enqueue` is only used for the `TaskNotFound` error (which itself uses `String`), both could be updated together.
- **Suggestion:** Consider accepting `TaskId` instead of `String` and converting internally where needed.

#### Suggestion 3: Duplicated `registryErrorToString` function
- **File:** `packages/chorus/src/Main.gren` (line 1008) and `packages/chorus/src/Web/Api.gren` (line 960)
- **Line:** 1008 / 960
- **Category:** Duplication
- **Description:** Both `Main.gren` and `Web/Api.gren` define their own `registryErrorToString` function with identical logic. This duplication existed before these changes but was touched by this PR (both had to update the `TaskNotFound` branch to use `Id.taskIdToString`). It would be cleaner to expose a single `errorToString` from `Task.Registry` itself.
- **Suggestion:** Consider adding `errorToString : Error -> String` to `Task.Registry` and using it from both `Main.gren` and `Web/Api.gren`, reducing the duplication.

#### Suggestion 4: Duplicated `statusMatches` / `statusEquals` logic
- **File:** `packages/chorus-ui/src/View/Dashboard.gren` (line 103) and `packages/shared/Types.gren` (line 916)
- **Line:** 103 / 916
- **Category:** Duplication
- **Description:** `Dashboard.gren` defines its own `statusMatches` function that is identical in behavior to `Types.statusEquals`. Since both modules already import `Types`, the dashboard could use `Types.statusEquals` instead of defining its own copy.
- **Suggestion:** Replace `statusMatches` in `Dashboard.gren` with a call to `Types.statusEquals`.

#### Suggestion 5: Backward-compatible decoder accepts `"agentWorkspace"` indefinitely
- **File:** `packages/shared/Types.gren`
- **Line:** 646-650
- **Category:** Simplification
- **Description:** The task decoder accepts both `"workspacePath"` and `"agentWorkspace"` via `Decode.oneOf` for backward compatibility with persisted data. This is a sensible migration strategy, but there is no comment or plan for when the fallback should be removed. Leaving dead fallback code indefinitely adds decoder complexity.
- **Suggestion:** Add a comment noting when the `"agentWorkspace"` fallback can be removed (e.g., "Remove after all persisted data has been migrated" or a target date).

#### Suggestion 6: `TaskId` equality comparison in `updateTask` relies on structural equality
- **File:** `packages/chorus/src/Task/Registry.gren`
- **Line:** 387
- **Category:** Correctness
- **Description:** The expression `summary.id == theTaskId` on line 387 compares two `TaskId` values using structural equality. In Gren, this works for custom types that wrap comparable values, so this is correct. However, the developer report notes that `Dict` keys must be `String` because custom types are not comparable, yet `==` is used here for filtering. This is fine because `==` (structural equality) and `comparable` (for `Dict`/`Set`) are different constraints in Gren. No action needed; just noting the correctness of this approach.
- **Suggestion:** No change needed. This is correct as-is.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The `Debug.todo` in `Task.Queue.enqueue` (Issue 1) must be fixed before merge. This is production code that will crash the runtime if the `Nothing` case is ever reached. The pattern for handling this correctly already exists in `Registry.createTask` and should be replicated. All other items are suggestions for future improvement.
