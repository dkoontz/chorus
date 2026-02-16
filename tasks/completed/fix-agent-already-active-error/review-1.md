# Code Review Report

## Summary

The implementation correctly embeds agent identity into the `TaskStatus` type, making the original "Agent already active" bug structurally impossible. The approach is clean, well-aligned with the project's "Make Invalid States Unrepresentable" coding standard, and all 85 tests pass. There is one blocking issue with the shared `statusDecoder` not handling pre-existing persisted data that lacks the `"agent"` field, and a few suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: statusDecoder in Types.gren will fail on pre-existing persisted task data

- **File:** `packages/shared/Types.gren`
- **Line:** 1214-1230
- **Category:** Correctness
- **Description:** The `statusDecoder` requires the `"agent"` field for `Planning`, `Active`, and `Waiting` statuses (`Decode.field "agent" Decode.string`). However, any task data persisted before this change was encoded as `{"type": "planning"}` without an `"agent"` field. When the application starts and loads existing task files from the `data/` directory, these will fail to decode, making all previously active/planning/waiting tasks unreadable.

    The `parseStatusBody` decoder in `Main.gren` (line 2276-2301) correctly uses `Decode.oneOf` to handle both with-agent and without-agent formats for API request bodies. But the canonical `statusDecoder` in `Types.gren` (used by `descriptionOnlyTaskDecoder` and `plannedTaskDecoder` for persistent storage) does not.

    While the project has a "no backwards compatibility" rule, this rule applies to decoders accepting data that does not match the current type. Here, the `"agent"` field is newly required data that was never previously present. The `parseStatusBody` decoder in `Main.gren` already demonstrates that the developer recognized this concern for API inputs but did not apply the same treatment to the persistence decoder. Existing task files on disk will have statuses like `{"type": "active"}` with no `"agent"` key, making them completely unloadable after this change.

- **Suggestion:** Apply the same `Decode.oneOf` pattern used in `parseStatusBody` to the `statusDecoder` in `Types.gren` for the `"planning"`, `"active"`, and `"waiting"` cases. Fall back to an empty `agentName` when the field is absent. This is consistent with the approach already taken in `statusFromString` and `parseStatusBody`. Alternatively, if the project genuinely intends for old data to fail (requiring users to delete their `data/` directory), add a comment in `statusDecoder` explicitly documenting this decision, and update any migration notes.

### Suggestions

#### Suggestion 1: Inline status string in ToolExecution event data duplicates statusToString logic

- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 435-444
- **Category:** Duplication
- **Description:** The `StatusChanged` event data for the "to" field uses an inline `when` expression matching on `report.status` to produce the string `"completed"`, `"waiting"`, or `"failed"`. Meanwhile, `newStatus` is already computed as a `TaskStatus` value a few lines above (line 388-397). The inline match was likely introduced to avoid calling `Types.statusToString newStatus` because `newStatus` now carries agent data (e.g. `Waiting { agentName = ... }`) and the developer wanted a clean string. However, `Types.statusToString` already handles this correctly by wildcarding the agent data (`Waiting _ -> "waiting"`), so this duplication is unnecessary.
- **Suggestion:** Replace the inline `when` expression with `Types.statusToString newStatus`. This keeps the event data consistent with how status strings are produced everywhere else, and avoids maintaining a parallel mapping.

#### Suggestion 2: requestApplyPlan and requestSetQuestions use hardcoded "planning" string

- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 427, 483
- **Category:** Style
- **Description:** The `requestApplyPlan` and `requestSetQuestions` functions hardcode `"planning"` as the "from" status in the `StatusChanged` event data, rather than calling `Types.statusToString` on the actual previous status. The developer did this to avoid needing to construct a `Planning` value with agent info just for string conversion. While this produces the correct string, it bypasses the canonical `statusToString` function and creates a coupling to the string representation.
- **Suggestion:** Either capture the previous status from the task before the update (as done in `requestUpdateStatus`) and use `Types.statusToString previousStatus`, or if that is too inconvenient, add a brief comment explaining why the literal string is used.

#### Suggestion 3: previousStatus fallback in ToolExecution uses Active with empty agent

- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 412-413
- **Category:** Correctness
- **Description:** When `maybeTask` is `Nothing` (task not found), `previousStatus` falls back to `Types.Active { agentName = "" }`. This is only used for the "from" field in a `StatusChanged` event log entry, so it is not functionally dangerous. However, it fabricates a status that did not exist. The task-not-found case here is already an anomaly since `updateTask` would also fail on a missing task.
- **Suggestion:** This is a pre-existing pattern (the original code used `Types.Active` as the fallback). No change required, but worth noting as a minor code smell.

#### Suggestion 4: Completed status test does not verify agent-carrying statuses round-trip through task encode/decode

- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 140
- **Category:** Correctness
- **Description:** `testStatusActive` tests encode/decode round-trip for `Active { agentName = "test-agent" }`, which is good. However, there is no corresponding round-trip test for `Planning { agentName = ... }` or `Waiting { agentName = ... }` to verify that the agent name survives a full task encode/decode cycle. The `testTaskCurrentAgentDerivedFromStatus` test verifies the accessor behavior but does not test persistence round-tripping.
- **Suggestion:** Add round-trip tests for `Planning` and `Waiting` statuses with agent data, similar to `testStatusActive`. This would catch issues like the blocking issue above (where `statusDecoder` might fail to decode the agent field).

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue (Issue 1) must be addressed. The `statusDecoder` in `Types.gren` will fail to decode any previously persisted task that was in a `Planning`, `Active`, or `Waiting` state, because those stored JSON objects do not contain the newly required `"agent"` field. The fix is straightforward: apply the same `Decode.oneOf` fallback pattern already used in `parseStatusBody` in `Main.gren`. Once that is resolved, the implementation is solid and well-structured.
