# QA Report

## Summary

All changes from iteration 2 have been verified. The blocking `Debug.todo` issue identified in review-1 is resolved, and all five suggestions from the first review have been addressed. Build succeeds (14 modules app, 8 modules UI, 5 modules tools), all 55 tests pass (36 unit, 19 integration), and the application runs correctly with all API endpoints functioning as expected.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify the project compiles without errors after iteration 2 changes.
- **Steps:**
  1. Run `npm run build:app` from the project root.
- **Expected:** All three packages (chorus-ui, tools, chorus) compile without errors.
- **Actual:** All packages compiled: 8 modules (UI), 5 modules (tools), 14 modules (chorus).
- **Status:** PASS

### Scenario 2: Unit tests pass
- **Description:** Verify all unit tests pass.
- **Steps:**
  1. Run `npm run test:unit` from `packages/chorus`.
- **Expected:** 36 tests pass, 0 fail.
- **Actual:** 36 passed, 0 failed.
- **Status:** PASS

### Scenario 3: Integration tests pass
- **Description:** Verify all integration tests pass.
- **Steps:**
  1. Run `npm run test:integration` from `packages/chorus`.
- **Expected:** 19 tests pass, 0 fail.
- **Actual:** 19 passed, 0 failed.
- **Status:** PASS

### Scenario 4: Create task returns `workspacePath` (not `agentWorkspace`)
- **Description:** Verify new tasks encode the workspace field as `workspacePath`.
- **Steps:**
  1. Start the application.
  2. POST `/api/tasks` with a valid body.
  3. Inspect the JSON response.
- **Expected:** The response JSON contains `"workspacePath"` key, not `"agentWorkspace"`.
- **Actual:** Response contained `"workspacePath": "/Users/.../data/workspaces/<uuid>"`. No `agentWorkspace` key present.
- **Status:** PASS

### Scenario 5: Get task by ID
- **Description:** Verify retrieving a single task by its ID works.
- **Steps:**
  1. Create a task via POST `/api/tasks`.
  2. GET `/api/tasks/<id>` with the returned ID.
- **Expected:** Returns 200 with the task data.
- **Actual:** Returned 200 with correct task data including `workspacePath`.
- **Status:** PASS

### Scenario 6: Get non-existent task returns 404
- **Description:** Verify requesting a non-existent task ID returns a proper error.
- **Steps:**
  1. GET `/api/tasks/nonexistent-task-id`.
- **Expected:** Returns error with "Task not found: nonexistent-task-id".
- **Actual:** Returned `{"error":{"code":"NOT_FOUND","message":"Task not found: nonexistent-task-id"}}`.
- **Status:** PASS

### Scenario 7: Whitespace-only task ID returns 404
- **Description:** Verify the router rejects whitespace-only task IDs via `Id.taskIdFromString`.
- **Steps:**
  1. GET `/api/tasks/%20%20%20` (URL-encoded whitespace).
- **Expected:** Returns 404 (NotFound route, since `taskIdFromString` returns `Nothing` for whitespace-only input).
- **Actual:** Returned HTTP 404.
- **Status:** PASS

### Scenario 8: Update task status
- **Description:** Verify updating a task's status works correctly.
- **Steps:**
  1. Create a task (starts as Pending).
  2. PUT `/api/tasks/<id>/status` with `{"status":{"type":"active"}}`.
- **Expected:** Returns 200 with status changed to active.
- **Actual:** Returned `{"type":"active"}`.
- **Status:** PASS

### Scenario 9: Update status on non-existent task
- **Description:** Verify updating status on a non-existent task returns an error.
- **Steps:**
  1. PUT `/api/tasks/does-not-exist/status` with `{"status":{"type":"active"}}`.
- **Expected:** Returns error with "Task not found" message.
- **Actual:** Returned `{"error":{"code":"REGISTRY_ERROR","message":"Task not found: does-not-exist"}}`.
- **Status:** PASS

### Scenario 10: Get task history
- **Description:** Verify task history is populated on creation.
- **Steps:**
  1. Create a task.
  2. GET `/api/tasks/<id>/history`.
- **Expected:** Returns history with a `task_created` event.
- **Actual:** Returned one event with `"eventType":"task_created"`.
- **Status:** PASS

### Scenario 11: Get and enqueue to task queue
- **Description:** Verify message queue operations work.
- **Steps:**
  1. Create a task.
  2. GET `/api/tasks/<id>/queue` (verify empty).
  3. POST `/api/tasks/<id>/queue` with `{"content":"Test message"}`.
- **Expected:** Empty queue initially; after enqueue, returns message with UUID id.
- **Actual:** Empty queue returned initially. Enqueue returned message with UUID `eb73d036-61a4-4c23-a727-a4938131890a` and correct content.
- **Status:** PASS

### Scenario 12: Update task planning (convert to Planned type)
- **Description:** Verify setting planning fields converts a DescriptionOnly task to Planned.
- **Steps:**
  1. Create a task (DescriptionOnly).
  2. PUT `/api/tasks/<id>/planning` with summary, requirements, criteria, and plan.
  3. GET `/api/tasks/<id>` and inspect `taskType`.
- **Expected:** Task type changes from `descriptionOnly` to `planned`.
- **Actual:** `taskType` changed to `"planned"` with correct summary and `workspacePath` preserved.
- **Status:** PASS

### Scenario 13: Invalid JSON body returns 400
- **Description:** Verify the API returns a proper error for malformed request bodies.
- **Steps:**
  1. POST `/api/tasks` with `{"bad":"json"}`.
- **Expected:** Returns 400 with bad request error.
- **Actual:** Returned `{"error":{"code":"BAD_REQUEST","message":"Invalid JSON body for task creation"}}`.
- **Status:** PASS

### Scenario 14: Filter tasks by status
- **Description:** Verify the status filter query parameter works.
- **Steps:**
  1. Create a task and set it to Active.
  2. GET `/api/tasks?status=active`.
  3. GET `/api/tasks?status=pending`.
- **Expected:** Active filter returns 1 task; Pending filter returns 0 tasks.
- **Actual:** Active returned 1, Pending returned 0.
- **Status:** PASS

### Scenario 15: UI dashboard renders correctly
- **Description:** Verify the web UI loads and displays task data.
- **Steps:**
  1. Navigate to `http://localhost:8080/` in a browser.
  2. Observe the dashboard stats and recent activity.
- **Expected:** Dashboard shows correct task counts and recent tasks.
- **Actual:** Dashboard displayed 2 total tasks, 1 pending, 1 active, with "QA test iteration 2" visible in recent activity. Status badges rendered correctly.
- **Status:** PASS

### Scenario 16: UI task list renders correctly
- **Description:** Verify the task list view displays task data properly.
- **Steps:**
  1. Navigate to `http://localhost:8080/tasks`.
  2. Observe the task table.
- **Expected:** Task list shows correct statuses, descriptions, sources, and action buttons.
- **Actual:** Task list displayed both tasks with correct Active/Pending badges, descriptions, source info, and appropriate action buttons (Pause/Complete for Active, Start for Pending).
- **Status:** PASS

### Scenario 17: Debug.todo removed from Queue.enqueue
- **Description:** Verify the blocking issue from review-1 is resolved.
- **Steps:**
  1. Read `packages/chorus/src/Task/Queue.gren` and verify the `enqueue` function.
- **Expected:** No `Debug.todo` in the `Nothing` branch of `messageIdFromString`; instead uses `GrenTask.fail`.
- **Actual:** Lines 74-76 use `GrenTask.fail (FileSystemError "Generated UUID was empty")` instead of `Debug.todo`.
- **Status:** PASS

### Scenario 18: Queue.Error.TaskNotFound uses TaskId
- **Description:** Verify suggestion 1 from review-1 was addressed.
- **Steps:**
  1. Read `packages/chorus/src/Task/Queue.gren` line 49.
- **Expected:** `TaskNotFound TaskId` instead of `TaskNotFound String`.
- **Actual:** Line 49 reads `| TaskNotFound TaskId`.
- **Status:** PASS

### Scenario 19: Queue.enqueue accepts TaskId
- **Description:** Verify suggestion 2 from review-1 was addressed.
- **Steps:**
  1. Read `packages/chorus/src/Task/Queue.gren` function signature for `enqueue`.
- **Expected:** Fourth parameter is `TaskId` not `String`.
- **Actual:** Line 63 shows `-> TaskId` in the type signature.
- **Status:** PASS

### Scenario 20: registryErrorToString deduplicated
- **Description:** Verify suggestion 3 from review-1 was addressed.
- **Steps:**
  1. Check `packages/chorus/src/Task/Registry.gren` for exported `errorToString`.
  2. Check `Main.gren` and `Web/Api.gren` no longer have local `registryErrorToString`.
- **Expected:** Single `errorToString` in Registry, callers use it.
- **Actual:** `Registry.errorToString` is defined at line 71 and exported. `Main.gren` line 303 uses `Registry.errorToString`. `Web/Api.gren` line 144 uses `Registry.errorToString`. No local copies remain.
- **Status:** PASS

### Scenario 21: Dashboard.statusMatches removed
- **Description:** Verify suggestion 4 from review-1 was addressed.
- **Steps:**
  1. Read `packages/chorus-ui/src/View/Dashboard.gren`.
- **Expected:** No `statusMatches` function; uses `Types.statusEquals` instead.
- **Actual:** `Dashboard.gren` uses `Types.statusEquals` at line 79 in `countByStatus`. No `statusMatches` function exists.
- **Status:** PASS

### Scenario 22: agentWorkspace fallback comment added
- **Description:** Verify suggestion 5 from review-1 was addressed.
- **Steps:**
  1. Read `packages/shared/Types.gren` decoder for `workspacePath`.
- **Expected:** TODO comment explaining when the `agentWorkspace` fallback can be removed.
- **Actual:** Lines 646-647 and 704-705 both contain: `-- TODO: Remove "agentWorkspace" fallback once all persisted task.json files have been re-written with the "workspacePath" key.`
- **Status:** PASS

## Failures

No failures found.

## Test Code Quality Issues

### Issue 1: Multiple assertions chained in attachment round-trip test
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 238-318
- **Problem:** `testAttachmentRoundTrip` chains 8+ assertions across two attachments (filename, size, contentType, uploadedAt for each). While this tests one logical concept (round-trip fidelity), a failure in an early assertion obscures whether later fields also fail.
- **Suggestion:** This is acceptable for round-trip tests but could be split into per-attachment tests if debugging becomes difficult.

### Issue 2: `queueErrorToString` duplicated between IntegrationRunner and Api
- **File:** `packages/chorus/tests/integration/IntegrationRunner.gren`
- **Line:** 673-680
- **Problem:** `queueErrorToString` in the integration test runner duplicates the same function in `Web/Api.gren`. This was noted in review-2 as well. Since `Queue` does not export an `errorToString`, both callers implement their own.
- **Suggestion:** Add `Queue.errorToString` to the `Task.Queue` module, matching the pattern established by `Registry.errorToString`.

### Issue 3: Integration test `testGetTaskReturnsNothingForMissing` uses a non-UUID string
- **File:** `packages/chorus/tests/integration/IntegrationRunner.gren`
- **Line:** 474
- **Problem:** The test uses `"nonexistent-task-id"` which passes `taskIdFromString` validation (it is non-empty after trimming) but is not a UUID format. This is fine for testing the "not found" path, but it means we never test that an actual UUID-formatted string that does not correspond to a task also returns Nothing. The current behavior is correct since lookup is path-based, but it is worth noting.
- **Suggestion:** No change needed. The test adequately verifies the "not found" code path.

## Integration Tests Added

No new integration tests were required for this iteration. The existing 19 integration tests were updated to work with the new types (`TaskId`, `MessageId`, `Queue.enqueue` accepting `TaskId`), and all pass.

| Test Name | File | Validates |
| --- | --- | --- |
| (existing tests updated) | `IntegrationRunner.gren` | Type changes compile and run correctly with `Id.taskIdToString`, `Id.messageIdToString`, `Queue.enqueue` with `TaskId` |

## Overall Assessment

**Decision:** PASS

All changes from iteration 2 are correct and working:

- The blocking `Debug.todo` in `Queue.enqueue` has been replaced with `GrenTask.fail`, matching the pattern in `Registry.createTask`.
- All five suggestions from review-1 have been addressed (Queue.Error type, Queue.enqueue signature, registryErrorToString deduplication, statusMatches removal, agentWorkspace fallback comment).
- The integration test runner was updated for the new types and the test script pipeline was fixed.
- Build compiles all 27 modules without errors.
- All 55 tests (36 unit + 19 integration) pass.
- The running application correctly creates tasks with `workspacePath`, handles all API endpoints, and renders the UI correctly.
- No regressions were observed.

The test code quality issues noted above are non-blocking and can be addressed in future work.
