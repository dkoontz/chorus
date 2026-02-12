# Developer Report

## Task
Add history event recording for planning lifecycle and status transitions so the event timeline shows the full story of a task's progression.

## Files Modified
- `packages/chorus/src/Main.gren` - Added `planning_started` event in `dispatchPlanner` (chained after status update to Planning), `planning_completed` event in `GotPlannerComplete`/`PlanResult` branch, `planning_questions_returned` event in `QuestionsResult` branch, `planning_failed` event in both `PlannerParseError` and `Err` branches, `answers_submitted` event in `GotAnswersSubmitted`/`ApiSuccess` branch. Added `countAnswersInPrompt` helper to count Q&A pairs from the enriched prompt.
- `packages/chorus/src/Web/Api.gren` - Added `status_changed` event recording in `requestUpdateStatus` (after successful status update, using the known from/to statuses), `requestApplyPlan` (Planning -> ReadyToStart), `requestSetQuestions` (Planning -> AwaitingInput), and `requestSubmitAnswers` (AwaitingInput -> Planning).
- `packages/chorus/src/Web/ToolExecution.gren` - Added `status_changed` event recording in `dispatchCompletionReport` by first reading the task to capture the previous status, then recording both `completion_report_submitted` and `status_changed` events after the update.
- `packages/chorus-ui/src/View/History.gren` - Extended `eventTypeClass` function with mappings for all new event types: `planning_started` -> `"planning"`, `planning_completed` -> `"planning"`, `planning_questions_returned` -> `"planning"`, `planning_failed` -> `"error"`, `answers_submitted` -> `"message"`, `status_changed` -> `"status"` (already existed). Also added mappings for existing events that were missing: `agent_handoff_started` -> `"handoff"`, `agent_handoff_completed` -> `"handoff"`, `tool_executed` -> `"tool"`, `completion_report_submitted` -> `"completion"`.

## Build Status
**Status:** PASS

All three packages compiled successfully:
- chorus-ui: 9 modules compiled
- tools: all tool binaries built
- chorus: 21 modules compiled

## Test Status
**Status:** PASS

- Unit tests: 27 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes
- All `recordEvent` calls in `Main.gren` use the fire-and-forget pattern: `|> GrenTask.onError (\_ -> GrenTask.succeed {}) |> GrenTask.perform (\_ -> NoOp)`, matching the existing `tool_executed` pattern. Event recording failures will not block primary operations.
- In `Web/Api.gren`, `status_changed` events are chained with `andThen` after the status update succeeds, using `GrenTask.onError` to swallow recording failures before continuing to build the response. This keeps event recording non-blocking for the primary operation's error handling.
- In `Web/ToolExecution.gren`, the `dispatchCompletionReport` function was restructured to read the task first (via `Registry.getTask`) to capture the previous status before the update. The `status_changed` event is recorded after the `completion_report_submitted` event, both chained via `andThen`.
- For `answers_submitted`, the answer count is derived from counting "Q: " lines in the enriched prompt, since the original `answers` array is not available in the `GotAnswersSubmitted` handler (only the enriched prompt string is passed through).
- The `status_changed` event is NOT added for transitions that already have dedicated events (e.g., `agent_handoff_started` already covers the transition to Active), per the task notes.
- The UI `eventTypeClass` function was extended beyond the minimum requirements to also map existing event types (`agent_handoff_started`, `agent_handoff_completed`, `tool_executed`, `completion_report_submitted`) that were previously falling through to `"default"`.
- The `planning_started` event is recorded by chaining after `Registry.updateStatus` in `dispatchPlanner`, inside the same `GrenTask.andThen` block. If the status update fails (swallowed by `onError`), the event won't be recorded either, which is the correct behavior since planning didn't actually start.

## Iteration
1
