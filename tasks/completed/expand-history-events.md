# Expand History Event Tracking

## Summary

Add history event recording for planning lifecycle and status transitions so the event timeline shows the full story of a task's progression, not just agent handoffs.

## Requirements

- Record a `planning_started` event when the planner agent is dispatched for a task
- Record a `planning_completed` event when the planner produces a successful plan
- Record a `planning_questions_returned` event when the planner returns questions instead of a plan
- Record a `planning_failed` event when the planner fails or produces unparseable output
- Record an `answers_submitted` event when a user submits answers to planning questions
- Record a `status_changed` event whenever a task's status changes, including the from/to states
- Update the UI's `eventTypeClass` function to map the new event types to appropriate CSS classes

## Acceptance Criteria

- [ ] `planning_started` event is recorded when `dispatchPlanner` sets status to `Planning`, with data key `"description"` containing the task description
- [ ] `planning_completed` event is recorded when `GotPlannerComplete` handles a `PlanResult`, with data key `"summary"` containing the plan summary
- [ ] `planning_questions_returned` event is recorded when `GotPlannerComplete` handles a `QuestionsResult`, with data key `"questionCount"` containing the number of questions as a string
- [ ] `planning_failed` event is recorded when `GotPlannerComplete` handles an `Err` or `PlannerParseError`, with data key `"error"` containing the error message
- [ ] `answers_submitted` event is recorded when answers are submitted via `requestSubmitAnswers` or `GotAnswersSubmitted`, with data key `"answerCount"` containing the number of answers as a string
- [ ] `status_changed` event is recorded whenever a task transitions status, with data keys `"from"` and `"to"` containing the status strings
- [ ] The UI `eventTypeClass` function in `View/History.gren` maps new event types to CSS classes (at minimum: `"planning_started"` -> `"planning"`, `"planning_completed"` -> `"planning"`, `"planning_failed"` -> `"error"`, `"answers_submitted"` -> `"message"`, `"status_changed"` -> `"status"`)
- [ ] Existing events (`task_created`, `agent_handoff_started`, `agent_handoff_completed`, `tool_executed`, `completion_report_submitted`) continue to work unchanged
- [ ] The app builds successfully with `npm run build:all`
- [ ] Existing tests pass with `npm run test`

## Out of Scope

- Adding new CSS styling for the timeline events (the existing generic styles are sufficient)
- Filtering or searching history events in the UI
- Adding new fields to the `Event` type (continue using the existing `eventType` string + `data` Dict pattern)
- Retroactively recording events for existing tasks
- Unit tests for the new events (integration tests cover this via the existing `recordEvent` test pattern)

## Technical Context

### Files to Modify

- `packages/chorus/src/Main.gren` - Add `recordEvent` calls in `dispatchPlanner`, `GotPlannerComplete`, and `GotAnswersSubmitted` message handlers
- `packages/chorus/src/Web/Api.gren` - Add `status_changed` event recording in `requestUpdateStatus`, `requestApplyPlan`, `requestSetQuestions`, and `requestSubmitAnswers`; optionally add `answers_submitted` event in `requestSubmitAnswers`
- `packages/chorus/src/Web/ToolExecution.gren` - Add `status_changed` event recording in `dispatchCompletionReport` when status changes via completion report
- `packages/chorus-ui/src/View/History.gren` - Extend `eventTypeClass` with mappings for new event types

### Related Files (reference only)

- `packages/shared/Types.gren` - Defines `Event`, `History`, `TaskStatus` types and `statusToString` helper. No changes needed.
- `packages/chorus/src/Task/Registry.gren` - Defines `recordEvent` function. No changes needed.
- `packages/chorus/tests/integration/IntegrationRunner.gren` - Has existing `testRecordEventAppendsToHistory` test. No changes needed unless adding new tests.

### Patterns to Follow

- Use `Registry.recordEvent` for all event recording, same pattern as `agent_handoff_started` in `requestStartHandoff` (Web/Api.gren around line 900)
- Event data uses `Dict String String` -- all values must be strings. Use `String.fromInt` for numeric values.
- In `Main.gren`, where you don't have an `ApiContext` but have `model.registry`, call `Registry.recordEvent reg taskId { eventType = "...", data = ... }` piped through `GrenTask.onError (\_ -> GrenTask.succeed {})` and `GrenTask.perform (\_ -> NoOp)`, matching the `tool_executed` pattern at Main.gren around line 755
- For `status_changed` events, use `Types.statusToString` to convert status values to strings for the `"from"` and `"to"` data keys
- In Api.gren functions that chain multiple tasks (like `requestApplyPlan`), add the `recordEvent` call after the task update succeeds, using `GrenTask.andThen` to chain it before the response is built
- Fire-and-forget pattern: when recording events from `Main.gren` Msg handlers that don't need to wait for the result, use `Cmd.batch` to fire the event recording alongside other commands

### Where to Add Each Event

1. **`planning_started`**: In `Main.gren` `dispatchPlanner` function, after `Registry.updateStatus registry taskId Types.Planning` succeeds (around line 1582). Add a `recordEvent` call chained after the status update.

2. **`planning_completed`**: In `Main.gren` `GotPlannerComplete` handler, in the `PlanResult fields` branch (around line 847). Add to the `Cmd.batch` alongside `requestApplyPlan`.

3. **`planning_questions_returned`**: In `Main.gren` `GotPlannerComplete` handler, in the `QuestionsResult questions` branch (around line 856). Add to the `Cmd.batch` alongside `requestSetQuestions`.

4. **`planning_failed`**: In `Main.gren` `GotPlannerComplete` handler, in the `PlannerParseError` branch (around line 865) and the `Err` branch (around line 874). Add to the `Cmd.batch` alongside `requestUpdateStatus`.

5. **`answers_submitted`**: In `Main.gren` `GotAnswersSubmitted` handler (around line 883), in the `ApiSuccess` branch. Add to the `Cmd.batch`. The answers have already been persisted by `requestSubmitAnswers` at this point.

6. **`status_changed`**: In `Web/Api.gren` `requestUpdateStatus` (around line 215), after `Registry.updateStatus` succeeds. Chain a `recordEvent` call. Also in `requestApplyPlan` (around line 335, status goes to ReadyToStart), `requestSetQuestions` (around line 360, status goes to AwaitingInput), and `Web/ToolExecution.gren` `dispatchCompletionReport` (around line 277, status goes to Completed/Waiting/Failed based on report).

## Testing Requirements

- Run `npm run build:all` to verify the app compiles
- Run `npm run test` to verify existing tests still pass
- Manual verification: create a task via the API, observe history.json contains the new events at appropriate lifecycle points
- Verify the UI renders new event types with readable labels (e.g., "Planning Started", "Status Changed")

## Notes

- The `Event` type uses `eventType : String` and `data : Dict String String`, so no changes to shared types are needed. New event types are just new string values.
- The UI's `formatEventType` function already handles arbitrary event type strings by replacing underscores with spaces and capitalizing, so new events will display reasonably even without explicit UI changes. The `eventTypeClass` update is for CSS class mapping only.
- For `status_changed` events, the `"from"` value requires knowing the previous status. In `requestUpdateStatus` this is available since the function already reads the task to validate the transition. In other places (like `requestApplyPlan`), the "from" status can be inferred from the flow (e.g., Planning -> ReadyToStart).
- Some status transitions happen implicitly (e.g., `requestStartHandoff` sets Active). These already have their own event types (`agent_handoff_started`) so a separate `status_changed` event is not needed for those -- only add `status_changed` for transitions that don't already have a dedicated event.
- All `recordEvent` calls should be non-blocking -- errors in event recording should not prevent the primary operation from succeeding. Use `GrenTask.onError (\_ -> GrenTask.succeed {})` to swallow recording failures.
