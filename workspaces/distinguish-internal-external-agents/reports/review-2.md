# Code Review Report

## Summary
The implementation correctly converts `AgentConfig` from a type alias with an `internal : Bool` field to a custom type with `InternalAgent` and `UserDefinedAgent` variants. All files compile, all 46 tests pass, and the migration is thorough -- no stale `.internal` field accesses remain. The code is well-structured and follows project conventions. Two suggestions for future improvement are noted below; no blocking issues were found.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Add `agentConfigInstructions` helper to reduce duplicated pattern matching
- **File:** `packages/shared/Types.gren` (new helper), `packages/chorus/src/Main.gren` (lines 519-525 and 1700-1706)
- **Category:** Duplication
- **Description:** The pattern of extracting `instructions` from `AgentConfig` via `when agentConfig is InternalAgent r -> r.instructions; UserDefinedAgent r -> r.instructions` is repeated twice in `Main.gren` (in `GotHandoffRecorded` and `dispatchPlanner`). Both `name` and `isInternalAgent` were given helpers; `instructions` was not, despite having the same "field exists on both variants" shape.
- **Suggestion:** Add an `agentConfigInstructions : AgentConfig -> String` helper in `Types.gren` alongside `agentConfigName`, and use it at both call sites. This follows the existing pattern established by `agentConfigName` and keeps the extraction logic in one place.

#### Suggestion 2: Consider whether `GotToolGrant` should reject for internal agents rather than silently no-op
- **File:** `packages/chorus/src/Main.gren` (lines 1029-1035)
- **Category:** Correctness
- **Description:** When `GotToolGrant` receives an `InternalAgent`, it silently returns the config unchanged (no-op). The developer report notes this is defensive since tool grants only happen for user-defined agents in practice. While this is safe, a more explicit approach would be to return a 400 error, consistent with how `GotAgentLookup` explicitly rejects internal agents. Silent no-ops can mask bugs if the invariant is ever violated in the future.
- **Suggestion:** Consider returning a `sendBadRequest response "Cannot update tools for internal agent"` instead of the silent no-op, or add a comment explaining why the no-op is intentionally safe. Either approach makes the behavior more visible to future maintainers.

## Overall Assessment

**Decision:** APPROVED

The implementation is clean and complete. The custom type design (`InternalAgent` / `UserDefinedAgent`) is a textbook application of the "make invalid states unrepresentable" principle from the project's coding standards -- an `InternalAgent` literally cannot have `provider`, `model`, or `allowedTools` fields, which is exactly the right constraint. The encoder/decoder pair is symmetric, the helpers (`agentConfigName`, `isInternalAgent`) are used consistently at call sites, the UI correctly filters internal agents from both the dropdown and the agents page, and the server-side guard on handoff correctly rejects internal agents with HTTP 400. The two suggestions above are minor improvements worth considering in future work.
