# Developer Report

## Task
Fix race condition on history.json where concurrent `Cmd.batch` commands fire multiple `recordEvent` calls (or mix `recordEvent` with API calls that internally chain `recordEvent`), causing one write to overwrite the other. The `planning_completed` event was being lost because it ran concurrently with `requestApplyPlan` which also writes to history.json via its `status_changed` event.

## Files Modified
- `packages/chorus/src/Web/Api.gren` - Modified four API functions to accept additional event data and record events sequentially in a single task chain:
  - `requestApplyPlan`: Added `planningCompletedData : Dict String String` parameter. Now records `planning_completed` then `status_changed` sequentially via `GrenTask.andThen`.
  - `requestSetQuestions`: Added `questionsEventData : Dict String String` parameter. Now records `planning_questions_returned` then `status_changed` sequentially.
  - `requestUpdateStatus`: Added `maybeExtraEvent : Maybe { eventType : String, data : Dict String String }` parameter. When `Just`, records the extra event before `status_changed` in the same chain.
  - `requestSubmitAnswers`: Now builds the `answers_submitted` event data internally (from the questions/answers it already has access to) and records it before `status_changed` in the same chain.

- `packages/chorus/src/Main.gren` - Removed all concurrent `recordEvent` calls from `Cmd.batch` blocks and instead pass event data to the API functions:
  - `PlanResult` branch: Builds `planningCompletedData` dict and passes it to `requestApplyPlan`. Removed separate `Registry.recordEvent` from `Cmd.batch`.
  - `QuestionsResult` branch: Builds `questionsEventData` dict and passes it to `requestSetQuestions`. Removed separate `Registry.recordEvent` from `Cmd.batch`.
  - `PlannerParseError` branch: Builds `planningFailedEvent` and passes as `Just` to `requestUpdateStatus`. Removed separate `Registry.recordEvent` from `Cmd.batch`.
  - `Err` branch: Builds `planningFailedEvent` and passes as `Just` to `requestUpdateStatus`. Removed separate `Registry.recordEvent` from `Cmd.batch`.
  - `GotAnswersSubmitted` handler: Removed `answersEventCmd` entirely (now recorded inside `requestSubmitAnswers`). Simplified destructuring to drop unused `questions`/`answers` fields.
  - `UpdateTaskStatus` route handler: Updated call to pass `Nothing` for the new extra event parameter.

## Build Status
**Status:** PASS

All three packages compiled successfully:
- chorus-ui: 9 modules compiled
- tools: all tool binaries built (file-tools, handoff-tool, task-tools, chorus-tools)
- chorus: 21 modules compiled

## Test Status
**Status:** PASS

- Unit tests: 27 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes
- The root cause was `Cmd.batch` firing multiple commands that each read/write history.json concurrently. When two commands read history.json at the same time, both get the same state. When both write back, the second write overwrites the first, losing one event.
- The fix moves all event recording into sequential `GrenTask.andThen` chains within the API functions, so each history.json write completes before the next one starts.
- For `requestApplyPlan` and `requestSetQuestions`, the caller passes the event data dict as a new parameter. The API function records the caller's event first, then `status_changed`, all sequentially.
- For `requestUpdateStatus`, a `Maybe` parameter allows passing an optional extra event. This keeps the function general-purpose (callers that don't need an extra event pass `Nothing`).
- For `requestSubmitAnswers`, the event data is built internally since the function already has access to all the needed data (questions from the task, answers from the parameter). This eliminates the need for the caller to build and pass event data.
- The `GotAnswersSubmitted` handler no longer needs `questions` or `answers` from the result record since the event is now recorded inside `requestSubmitAnswers`. The destructuring pattern was simplified accordingly.
- All `recordEvent` calls within the chains include `GrenTask.onError (\_ -> GrenTask.succeed {})` to ensure event recording failures don't prevent the primary operation from succeeding.

## Iteration
4
