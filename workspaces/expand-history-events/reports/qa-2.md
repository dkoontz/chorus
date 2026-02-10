# QA Report

## Summary

Iteration 2 enhances the `planning_questions_returned` and `answers_submitted` events to store actual question and answer content (as `question_1`, `question_2`, `answer_1`, `answer_2` keys) in addition to the existing count fields. All tested scenarios pass. Build succeeds and all 46 existing tests pass.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify the app compiles after iteration 2 changes
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** All modules compile without errors
- **Actual:** All modules compiled successfully (UI: 9 modules, tools: 7+7+3+6 modules, chorus: 21 modules)
- **Status:** PASS

### Scenario 2: All existing tests pass
- **Description:** Verify no regressions in existing test suite
- **Steps:**
  1. Run `npm run test`
- **Expected:** All unit and integration tests pass
- **Actual:** 27 unit tests passed, 19 integration tests passed
- **Status:** PASS

### Scenario 3: planning_questions_returned event includes question content
- **Description:** Verify the `planning_questions_returned` event contains actual question text in `question_N` keys
- **Steps:**
  1. Create a task via `POST /api/tasks`
  2. Wait for planner to return questions (planner auto-dispatched on task creation)
  3. Read `history.json` from the task's registry directory
- **Expected:** The `planning_questions_returned` event should contain `questionCount`, `question_1`, `question_2`, etc. with actual question text
- **Actual:** Event contained `{"questionCount":"2","question_1":"What format should the output be in? (e.g., plain text, markdown, JSON, a file in the repo, etc.)","question_2":"How many haiku would you like? (just one, or several?)"}`
- **Status:** PASS

### Scenario 4: answers_submitted event includes question and answer content
- **Description:** Verify the `answers_submitted` event contains actual question and answer text
- **Steps:**
  1. After planner returns questions (task in AwaitingInput status), submit answers via `POST /api/tasks/:id/answers` with body `{"answers":["Plain text format please","Write exactly three haiku"]}`
  2. Read `history.json` from the task's registry directory
- **Expected:** The `answers_submitted` event should contain `answerCount`, `question_1`, `question_2`, `answer_1`, `answer_2` with actual text
- **Actual:** Event contained `{"answerCount":"2","answer_1":"Plain text format please","answer_2":"Write exactly three haiku","question_1":"What format should the output be in? (e.g., plain text, markdown, JSON, a file in the repo, etc.)","question_2":"How many haiku would you like? (just one, or several?)"}`
- **Status:** PASS

### Scenario 5: Existing event types still work (task_created)
- **Description:** Verify `task_created` event is recorded on task creation
- **Steps:**
  1. Create a task via `POST /api/tasks`
  2. Check history.json
- **Expected:** First event is `task_created` with description
- **Actual:** `{"eventType":"task_created","data":{"description":"Write a haiku about testing software..."}}`
- **Status:** PASS

### Scenario 6: planning_started event records description
- **Description:** Verify `planning_started` event fires when planner is dispatched
- **Steps:**
  1. Create a task (planner auto-dispatches)
  2. Check history.json
- **Expected:** `planning_started` event with task description in data
- **Actual:** `{"eventType":"planning_started","data":{"description":"Write a haiku about testing software..."}}`
- **Status:** PASS

### Scenario 7: planning_completed event records summary
- **Description:** Verify `planning_completed` event fires when planner produces a plan
- **Steps:**
  1. After submitting answers, planner re-dispatches and produces a plan
  2. Check history.json
- **Expected:** `planning_completed` event with plan summary
- **Actual:** `{"eventType":"planning_completed","data":{"summary":"Write three haiku about testing software in plain text format"}}`
- **Status:** PASS

### Scenario 8: status_changed events record from/to states
- **Description:** Verify `status_changed` events track state transitions
- **Steps:**
  1. Observe automatic transitions (planning -> awaiting_input, awaiting_input -> planning, planning -> planned)
  2. Trigger manual transition via `PUT /api/tasks/:id/status` (planned -> failed)
- **Expected:** Each transition records `from` and `to` status strings
- **Actual:** All transitions correctly recorded: `planning->awaiting_input`, `awaiting_input->planning`, `planning->planned`, `planned->failed`
- **Status:** PASS

### Scenario 9: planning_failed event records error
- **Description:** Verify `planning_failed` event fires when planner times out or fails
- **Steps:**
  1. Create a task where planner CLI times out
  2. Check history.json after timeout
- **Expected:** `planning_failed` event with error message
- **Actual:** `{"eventType":"planning_failed","data":{"error":"Planner failed: Planner CLI exited with code null: "}}`
- **Status:** PASS

### Scenario 10: Full event lifecycle sequence
- **Description:** Verify the complete sequence of events through a full planning lifecycle
- **Steps:**
  1. Create task
  2. Planner returns questions
  3. Submit answers
  4. Planner completes plan
  5. Manually transition to failed
- **Expected:** Events in order: task_created, planning_started, planning_questions_returned, status_changed (planning->awaiting_input), status_changed (awaiting_input->planning), answers_submitted, planning_started, planning_completed, status_changed (planning->planned), status_changed (planned->failed)
- **Actual:** Exactly 10 events in the expected order
- **Status:** PASS

### Scenario 11: UI eventTypeClass mappings
- **Description:** Verify new event types map to appropriate CSS classes in View/History.gren
- **Steps:**
  1. Review `eventTypeClass` function in `packages/chorus-ui/src/View/History.gren`
- **Expected:** `planning_started` -> `"planning"`, `planning_completed` -> `"planning"`, `planning_questions_returned` -> `"planning"`, `planning_failed` -> `"error"`, `answers_submitted` -> `"message"`, `status_changed` -> `"status"`
- **Actual:** All mappings present and correct. Additionally includes `agent_handoff_started` -> `"handoff"`, `agent_handoff_completed` -> `"handoff"`, `tool_executed` -> `"tool"`, `completion_report_submitted` -> `"completion"`
- **Status:** PASS

### Scenario 12: Backward compatibility of questionCount and answerCount
- **Description:** Verify that `questionCount` is still present in `planning_questions_returned` and `answerCount` in `answers_submitted`
- **Steps:**
  1. Check event data for both event types
- **Expected:** Count fields preserved alongside new content fields
- **Actual:** `planning_questions_returned` has `questionCount: "2"` plus `question_1`, `question_2`; `answers_submitted` has `answerCount: "2"` plus `question_1`, `question_2`, `answer_1`, `answer_2`
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No new test files were added in this iteration. The task spec explicitly states unit tests for new events are out of scope. The QA_STANDARDS.md integration test framework (`packages/tools/tests/integration/*.json`) is designed for CLI tool testing, not for Chorus app event recording, so adding JSON integration tests here would not be applicable.

## Integration Tests Added

No integration tests were added. The integration test framework is designed for CLI tools (`packages/tools/tests/integration/*.json`), not for the Chorus application's event recording system which runs as a server. The event recording behavior is verified through manual API testing and code review.

## Overall Assessment

**Decision:** PASS

All iteration 2 enhancements work correctly:
- `planning_questions_returned` events now contain actual question text as `question_1`, `question_2`, etc.
- `answers_submitted` events now contain both question text (`question_N`) and answer text (`answer_N`)
- Backward-compatible count fields (`questionCount`, `answerCount`) are preserved
- All existing events continue to function unchanged
- Build compiles and all 46 tests pass
- UI CSS class mappings are correct for all event types
