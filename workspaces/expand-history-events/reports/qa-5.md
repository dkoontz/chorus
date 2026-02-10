# QA Report

## Summary

Iteration 5 passes all acceptance criteria. The critical `planning_completed` event is now reliably recorded in task history after the planner produces a plan -- the race condition fix (moving event recording into sequential `GrenTask.andThen` chains) is confirmed working. Build succeeds (21 modules for chorus, 9 for UI, tools compiled), all 46 tests pass (27 unit, 19 integration), and all event types contain correct data.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify the app compiles after iteration 5 changes
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** All modules compile without errors
- **Actual:** All modules compiled successfully (UI: 9 modules, tools compiled, chorus: 21 modules)
- **Status:** PASS

### Scenario 2: All existing tests pass
- **Description:** Verify no regressions in the test suite
- **Steps:**
  1. Run `npm run test`
- **Expected:** All unit and integration tests pass
- **Actual:** 27 unit tests passed, 19 integration tests passed
- **Status:** PASS

### Scenario 3: planning_completed event appears in history after planner produces a plan (CRITICAL)
- **Description:** This was the original bug -- the `planning_completed` event was being lost due to a race condition with concurrent `Cmd.batch` commands overwriting `history.json`. Verify the fix works.
- **Steps:**
  1. Start the app from the worktree `dist/` directory
  2. Create a task via `POST /api/tasks` with body `{"description": "Write a short poem about code quality", "source": {"sourceType": "api", "userId": "qa-agent", "conversationId": null}}`
  3. Wait for planner to auto-dispatch and produce a plan (task status transitions to "planned")
  4. Read history via `GET /api/tasks/:id/history`
  5. Also read the raw `history.json` file on disk to confirm persistence
- **Expected:** The `planning_completed` event should be present with `summary`, `requirement_*`, `acceptance_criteria_*`, `plan_step_*`, and `assigned_agent` keys
- **Actual:** Task reached "planned" status after ~9 seconds. History contained 4 events: `task_created`, `planning_started`, `planning_completed`, `status_changed`. The `planning_completed` event data contained: `summary` ("Write a short poem about code quality"), `requirement_1`, `acceptance_criteria_1`, `plan_step_1`, and `assigned_agent` ("writer"). The raw `history.json` file on disk confirmed all events were persisted correctly with no data loss.
- **Status:** PASS

### Scenario 4: planning_started event records task description
- **Description:** Verify `planning_started` event is recorded when planner is dispatched
- **Steps:**
  1. Check the `planning_started` event from the task created in Scenario 3
- **Expected:** Event with data key `"description"` containing the task description
- **Actual:** `{"eventType": "planning_started", "data": {"description": "Write a short poem about code quality"}}`
- **Status:** PASS

### Scenario 5: status_changed event records from/to states
- **Description:** Verify `status_changed` events include correct from and to status strings
- **Steps:**
  1. Check `status_changed` events from the task created in Scenario 3
  2. Manually transition the task to failed via `PUT /api/tasks/:id/status`
  3. Check the newly recorded `status_changed` event
- **Expected:** Each `status_changed` has `from` and `to` data keys with status strings
- **Actual:** Auto-generated event: `{"from": "planning", "to": "planned"}`. After manual transition: `{"from": "planned", "to": "failed"}`. Both correct.
- **Status:** PASS

### Scenario 6: answers_submitted event includes Q&A content
- **Description:** Verify the `answers_submitted` event contains actual question and answer text
- **Steps:**
  1. Check the `answers_submitted` event from the pre-existing task (717e5f22) which went through the questions flow
- **Expected:** Event contains `answerCount`, `question_1`, `question_2`, `answer_1`, `answer_2` with actual text
- **Actual:** Event contained `{"answerCount": "2", "answer_1": "Plain text format please", "answer_2": "Write exactly three haiku", "question_1": "What format should the output be in? ...", "question_2": "How many haiku would you like? ..."}`
- **Status:** PASS

### Scenario 7: planning_questions_returned event includes questions
- **Description:** Verify the `planning_questions_returned` event stores question content
- **Steps:**
  1. Check the `planning_questions_returned` event from the pre-existing task (717e5f22)
- **Expected:** Event contains `questionCount` and individual `question_N` keys
- **Actual:** Event contained `{"questionCount": "2", "question_1": "What format should the output be in? ...", "question_2": "How many haiku would you like? ..."}`
- **Status:** PASS

### Scenario 8: Full lifecycle event sequence with questions flow
- **Description:** Verify the complete event sequence for a task that went through questions, answers, re-planning, and completion
- **Steps:**
  1. Check all events for task 717e5f22 (which had the full questions lifecycle)
- **Expected:** Events in order: task_created, planning_started, planning_questions_returned, status_changed (planning->awaiting_input), status_changed (awaiting_input->planning), answers_submitted, planning_started (second round), planning_completed, status_changed (planning->planned), status_changed (planned->failed)
- **Actual:** Exactly 10 events in the expected order with correct data in each
- **Status:** PASS

### Scenario 9: No race condition -- all events persisted on disk
- **Description:** Verify that events are not lost to concurrent file writes
- **Steps:**
  1. Read the raw `history.json` file for the newly created task (7d72a163)
  2. Compare with API response
- **Expected:** File on disk matches API response with all events present
- **Actual:** File contained 5 events (`task_created`, `planning_started`, `planning_completed`, `status_changed` x2), matching the API response exactly. No events were lost.
- **Status:** PASS

### Scenario 10: UI eventTypeClass mappings are correct
- **Description:** Verify the CSS class mappings in `View/History.gren` cover all new event types
- **Steps:**
  1. Review the `eventTypeClass` function in `View/History.gren`
- **Expected:** `planning_started` -> `"planning"`, `planning_completed` -> `"planning"`, `planning_questions_returned` -> `"planning"`, `planning_failed` -> `"error"`, `answers_submitted` -> `"message"`, `status_changed` -> `"status"`
- **Actual:** All mappings present at lines 100-148. Additionally includes existing mappings for `task_created`, `agent_handoff_started`, `agent_handoff_completed`, `tool_executed`, `completion_report_submitted`, and fallback `_` -> `"default"`.
- **Status:** PASS

### Scenario 11: GrenTask.onError on all recordEvent calls in ToolExecution.gren
- **Description:** Verify the iteration 5 blocking fix -- both `recordEvent` calls in `dispatchCompletionReport` have error handlers
- **Steps:**
  1. Review `ToolExecution.gren` `dispatchCompletionReport` function (lines 327-388)
- **Expected:** Each `recordEvent` call followed by `GrenTask.onError (\_ -> GrenTask.succeed {})`
- **Actual:** Line 350: `completion_report_submitted` recordEvent has `|> GrenTask.onError (\_ -> GrenTask.succeed {})`. Line 361: `status_changed` recordEvent has `|> GrenTask.onError (\_ -> GrenTask.succeed {})`. Both are correctly guarded.
- **Status:** PASS

### Scenario 12: Dead fields removed from GotAnswersSubmitted
- **Description:** Verify the iteration 5 cleanup -- `questions` and `answers` fields are removed from the `GotAnswersSubmitted` Msg variant
- **Steps:**
  1. Review `Main.gren` GotAnswersSubmitted definition (line 221)
  2. Review `Api.gren` requestSubmitAnswers return type (line 470)
- **Expected:** Only `response`, `taskId`, `enrichedPrompt`, and `result` fields remain
- **Actual:** `GotAnswersSubmitted { response : Response, taskId : TaskId, enrichedPrompt : String, result : Api.ApiResult }` -- no `questions` or `answers` fields. The `requestSubmitAnswers` return type is `{ apiResult : ApiResult, enrichedPrompt : String }` -- no dead fields.
- **Status:** PASS

### Scenario 13: indexedArrayToDict helper extracted in Api.gren
- **Description:** Verify the helper was extracted and is used in `requestSubmitAnswers`
- **Steps:**
  1. Review Api.gren for the `indexedArrayToDict` helper function
  2. Verify it's used in `requestSubmitAnswers`
- **Expected:** Local private helper at bottom of HELPERS section, used in answersEventData construction
- **Actual:** `indexedArrayToDict` defined at lines 1453-1462 in Api.gren, identical to the one in Main.gren. Used at line 538 to build `answersEventData`: `Dict.foldl Dict.set (indexedArrayToDict "question_" questionStrings) (indexedArrayToDict "answer_" answers)`.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No new test files were added in this iteration. The task spec explicitly states unit tests for new events are out of scope. The integration test framework (`packages/tools/tests/integration/*.json`) is designed for CLI tool testing, not for Chorus app event recording.

## Integration Tests Added

No integration tests were added. The integration test framework is designed for CLI tools (`packages/tools/tests/integration/*.json`), not for the Chorus application's event recording system which runs as a server. The event recording behavior is verified through manual API testing against the running application.

## Overall Assessment

**Decision:** PASS

The critical bug (race condition causing `planning_completed` events to be lost) is fixed and verified. Creating a fresh task, letting the planner auto-dispatch and produce a plan, then checking history.json confirms the `planning_completed` event is present with full plan content (summary, requirements, acceptance criteria, plan steps, assigned agent).

All acceptance criteria are met:
- `planning_started` event recorded with task description
- `planning_completed` event recorded with plan summary and full plan content
- `planning_questions_returned` event recorded with question count and individual questions
- `planning_failed` event path verified via code review (correctly uses sequential chain in `requestUpdateStatus`)
- `answers_submitted` event recorded with answer count, questions, and answers
- `status_changed` event recorded for all status transitions with from/to states
- UI `eventTypeClass` function maps all new event types to correct CSS classes
- Existing events continue to work unchanged
- Build succeeds and all 46 tests pass
- The race condition fix (sequential `GrenTask.andThen` chains instead of `Cmd.batch` for event recording) is confirmed working across all event paths
