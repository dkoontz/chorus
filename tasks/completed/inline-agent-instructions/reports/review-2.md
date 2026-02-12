# Code Review Report

## Summary

Iteration 2 addresses the blocking issue (missing existence check in `requestCreateAgent`) and three of the five non-blocking suggestions from the first review. All four fixes are correctly implemented and the code is consistent with project conventions and coding standards.

## Issues Found

### BLOCKING Issues

No blocking issues found.

### Suggestions

#### Suggestion 1: The `requestCreateAgent` existence check has a nested `onError` that could mask errors
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 877-900
- **Category:** Correctness
- **Description:** The new existence-check logic in `requestCreateAgent` works by calling `getAgent`, then using `onError` to branch on `AgentNotFound`. Inside the `AgentNotFound` branch, the creation pipeline has its own nested `onError` (line 892-895) that catches creation errors and returns a 500. This is correct but the nesting makes the control flow harder to follow. The outer `onError` on line 877 handles errors from `getAgent`, and inside the `AgentNotFound` branch there is an entire sub-pipeline with its own error handling. If `updateAgent` were to fail with `AgentNotFound` (unlikely but theoretically possible), it would be caught by the inner `onError` as a 500 rather than propagating to the outer handler. In practice this is not a real problem since `updateAgent` writes a file and would not produce `AgentNotFound`, but the nested error handling structure is worth noting for future maintainability.
- **Suggestion:** No code change required now. If this function grows more complex in the future, consider extracting the creation sub-pipeline into a separate helper function to flatten the nesting.

#### Suggestion 2: `sendServiceUnavailable` and `sendNotFound` still use string concatenation for JSON
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 771-777 and 807-812
- **Category:** Style
- **Description:** While `sendBadRequest` was correctly updated to use `Json.Encode` for proper JSON construction, the sibling functions `sendServiceUnavailable` (line 776) and `sendNotFound` (line 811) still use hand-written JSON string literals. These are safe because they use only static strings with no user input, so there is no escaping risk. However, updating them to use `Json.Encode` would make the three response helpers stylistically consistent.
- **Suggestion:** Consider updating `sendServiceUnavailable` and `sendNotFound` to use `Encode.object` and `Encode.encode 0` for consistency with the updated `sendBadRequest`, though this is purely cosmetic since the static strings are safe.

## Overall Assessment

**Decision:** APPROVED

All four changes in this iteration are well-implemented:

1. **BLOCKING fix (409 Conflict check):** The `requestCreateAgent` function now correctly checks for an existing agent before creating, returning 409 Conflict when one exists. The implementation follows the same check-then-act pattern used by `requestStartHandoff`, maintaining API consistency.

2. **Duplication fix (getAgent refactored):** `getAgent` now delegates to `readAgentConfigFile` with ENOENT-to-AgentNotFound mapping applied via `GrenTask.onError`, cleanly eliminating the duplicated file-reading logic.

3. **Decoder strictness fix:** The `agentConfigDecoder` fallback now requires the presence of a `specPath` field rather than unconditionally succeeding. This aligns with the project's "Fail on Malformed or Missing Data" coding standard while still supporting backward compatibility with old-format JSON files.

4. **JSON escaping fix:** `sendBadRequest` now uses `Json.Encode.object` and `Json.Encode.string` to construct the response body, properly escaping any special characters in error messages.

The three suggestions not addressed (seed agent deletion guard, UI confirmation dialog, ExecRunning vs ExecStarting status) were reasonably deferred with clear rationale in the developer report.
