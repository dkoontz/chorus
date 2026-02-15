# QA Report

## Summary

Iteration 4 addresses two items from the review-3 feedback: a blocking issue where early-exit errors in `dispatchPlanner` were silently dropped, and a suggestion to simplify the `alreadySubmitted` check. Both changes are correctly implemented, the build succeeds, and all 96 tests (77 unit + 19 integration) pass. The blocking issue is resolved.

## Test Scenarios

### Scenario 1: Build compiles without errors
- **Description:** Verify `npm run build:all` completes successfully
- **Steps:**
  1. Run `npm run build:all` in the worktree
- **Expected:** All components (UI, tools, chorus) compile and the dist is assembled
- **Actual:** Build succeeded. All 13 UI modules, 5 tools modules, and 24 chorus modules compiled. Dist assembled.
- **Status:** PASS

### Scenario 2: Unit tests pass
- **Description:** Verify `npm run test:unit` passes
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** All unit tests pass
- **Actual:** 77 passed, 0 failed
- **Status:** PASS

### Scenario 3: Integration tests pass
- **Description:** Verify `npm run test:integration` passes
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** All integration tests pass
- **Actual:** 19 passed, 0 failed
- **Status:** PASS

### Scenario 4: Plan task with unconfigured system agent provider returns error to user
- **Description:** Verify that attempting to plan a task when the system agent provider is not configured returns a visible error rather than silently failing
- **Steps:**
  1. Start the application
  2. Create a workspace config at `/tmp/chorus-qa-test` via `POST /api/config/create`
  3. Create a task via `POST /api/tasks`
  4. Attempt to plan the task via `POST /api/tasks/{id}/plan`
- **Expected:** HTTP response returns an error indicating the provider is not configured
- **Actual:** Received `409 Conflict` with message "System agent provider is not configured. Please configure it in System Settings."
- **Status:** PASS

### Scenario 5: failPlannerEarly correctly matches handlePlannerComplete error pattern
- **Description:** Code review to verify that `failPlannerEarly` follows the same error handling pattern as `handlePlannerComplete`'s `PlannerExitError` branch
- **Steps:**
  1. Read `failPlannerEarly` function (lines 2629-2661)
  2. Read `handlePlannerComplete` `PlannerExitError` branch (lines 2757-2784)
  3. Compare the two implementations
- **Expected:** Both paths fail the task with `Types.Failed`, record a `PlanningFailed` event, log the error, and broadcast to WebSocket clients
- **Actual:** Both implementations are structurally identical:
  - Both call `Api.requestUpdateStatus` with `Types.Failed ("Planner failed: " ++ errorMessage)`
  - Both record a `PlanningFailed` event with the error in the event data
  - Both log the error via `Logging.logError`
  - Both broadcast to WebSocket clients
  - `failPlannerEarly` correctly uses `model` (no executor to remove) while `handlePlannerComplete` uses `updatedModel` (executor removed)
- **Status:** PASS

### Scenario 6: alreadySubmitted simplification is logically equivalent
- **Description:** Verify the new pipeline-style `alreadySubmitted` check is logically equivalent to the original nested `when` expressions
- **Steps:**
  1. Read the new implementation (lines 809-815)
  2. Trace the logic: `Dict.get` returns `Maybe ExecutorState`, `Maybe.andThen .completionReport` extracts the nested `Maybe CompletionReport`, `isJust` converts to Bool
  3. Verify `isJust` helper (lines 3325-3332) is correct
- **Expected:** The pipeline produces `True` when an executor exists AND its `completionReport` is `Just _`, and `False` otherwise
- **Actual:** The logic is correct. `Dict.get` returns `Nothing` if no executor -> `Maybe.andThen` propagates `Nothing` -> `isJust` returns `False`. If executor exists but `completionReport` is `Nothing` -> `Maybe.andThen` returns `Nothing` -> `isJust` returns `False`. If executor exists and `completionReport` is `Just _` -> `Maybe.andThen` returns `Just _` -> `isJust` returns `True`.
- **Status:** PASS

### Scenario 7: Task status remains Pending when HTTP pre-check catches the error
- **Description:** Verify that the HTTP handler's pre-check for the system agent provider is the first line of defense, preventing `dispatchPlanner` from being called at all
- **Steps:**
  1. After scenario 4, check the task status via `GET /api/tasks/{id}`
  2. Check the task history via `GET /api/tasks/{id}/history`
- **Expected:** Task remains in Pending state since the error was caught at the HTTP handler level (lines 1835-1840), before `dispatchPlanner` was called
- **Actual:** Task status is `pending`. History shows only `task_created` event, no `PlanningFailed` event. This is correct behavior -- the HTTP handler rejects the request before `dispatchPlanner` is reached, so `failPlannerEarly` is not invoked. The `failPlannerEarly` function serves as a defensive fallback for edge cases (e.g., if `dispatchPlanner` is called from a code path that bypasses the HTTP pre-check).
- **Status:** PASS

## Failures

No failures found.

## Test Code Quality Issues

### Issue 1: No unit tests for isJust helper
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 3325
- **Problem:** The new `isJust` helper function has no unit tests. While it is a trivial function, it is used in business logic (the exactly-once enforcement check).
- **Suggestion:** This is a minor observation. The function is simple enough that its correctness is self-evident from code review.

### Issue 2: No unit tests for Agent.Manager module
- **File:** `packages/chorus/src/Agent/Manager.gren`
- **Line:** N/A
- **Problem:** The `Agent.Manager` module, introduced in earlier iterations, has no corresponding test file despite the plan specifying it as "intentionally pure (no IO imports) to keep business logic testable." Its pure functions (`processAgentCompletion`, `processPlannerCompletion`, `shouldRetry`) are ideal unit test candidates.
- **Suggestion:** This is not new to iteration 4, but is worth noting as a gap. Adding unit tests for `Agent.Manager` would validate the core decision logic that drives agent completion, planner completion, and retry behavior.

## Integration Tests Added

No tool-level integration tests were added. The changes in this iteration affect the Chorus application's internal error handling in `Main.gren`, not the tools package. The existing unit and integration test suites cover the affected functionality. The `failPlannerEarly` function is a defensive fallback that handles edge cases in `dispatchPlanner`; the primary error path (system agent provider not configured) is handled at the HTTP handler level before `dispatchPlanner` is called.

## Overall Assessment

**Decision:** PASS

The blocking issue from review-3 (early-exit errors in `dispatchPlanner` silently dropped) is correctly resolved. The `failPlannerEarly` function properly fails the task with a descriptive error, records a `PlanningFailed` event, logs the error, and broadcasts to WebSocket clients -- matching the established error handling pattern in `handlePlannerComplete`. The `alreadySubmitted` simplification is logically equivalent to the original code and improves readability. All tests pass and the build is clean.

Non-blocking observations:
- The `Agent.Manager` module remains untested despite being designed for testability. This predates iteration 4 but represents a testing gap.
- Suggestion 2 from review-3 (silently swallowed errors in event recording) was intentionally deferred, which is reasonable since it is a pre-existing pattern used throughout the file.
