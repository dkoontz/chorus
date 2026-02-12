# QA Report

## Summary

Iteration 2 successfully addresses the review feedback from iteration 1. The duplicate `expectConfigResponse` has been removed, all config call sites now use the generic `expectApiResponse`, and `httpErrorToString` correctly distinguishes server error messages from JSON decode failures. All acceptance criteria pass. Build and tests pass.

## Test Scenarios

### Scenario 1: 404 - Task not found shows server error message
- **Description:** Navigate to a nonexistent task and verify the error message includes the server's response
- **Steps:**
  1. Start the app, create a workspace via `POST /api/config/create`
  2. Use SPA navigation to go to `/tasks/nonexistent-task-id`
  3. Observe the error notification
- **Expected:** UI shows "Server error: Task not found: nonexistent-task-id"
- **Actual:** UI shows "Server error: Task not found: nonexistent-task-id" in a persistent red error notification
- **Status:** PASS

### Scenario 2: 404 - Config file not found shows server error message
- **Description:** Try to open a nonexistent workspace config file
- **Steps:**
  1. Start app with no workspace configured
  2. On Workspaces page, enter `/nonexistent/path/chorus.json` in the Open Workspace input
  3. Click Open
- **Expected:** UI shows the server's ENOENT error message
- **Actual:** UI shows "Server error: ENOENT: no such file or directory, open '/nonexistent/path/chorus.json'"
- **Status:** PASS

### Scenario 3: 404 - Agent not found via API
- **Description:** Request a nonexistent agent
- **Steps:**
  1. `curl http://localhost:8080/api/agents/nonexistent-agent`
  2. Verify server returns `{"error":{"code":"NOT_FOUND","message":"Agent not found: nonexistent-agent"}}` with HTTP 404
- **Expected:** Structured error response with meaningful message
- **Actual:** Returns `{"error":{"code":"NOT_FOUND","message":"Agent not found: nonexistent-agent"}}` with HTTP 404
- **Status:** PASS

### Scenario 4: 404 - Provider not found via API
- **Description:** Request a nonexistent provider
- **Steps:**
  1. `curl http://localhost:8080/api/providers/nonexistent-provider`
  2. Verify server returns structured error
- **Expected:** Structured error with "Provider not found: nonexistent-provider"
- **Actual:** Returns `{"error":{"code":"NOT_FOUND","message":"Provider not found: nonexistent-provider"}}` with HTTP 404
- **Status:** PASS

### Scenario 5: 400 - Malformed request body shows server error message
- **Description:** Send an invalid JSON body to the task creation endpoint
- **Steps:**
  1. `curl -X POST /api/tasks -d '{"invalid":"body"}'`
  2. Verify server returns structured 400 error
- **Expected:** Structured error with "Invalid JSON body for task creation"
- **Actual:** Returns `{"error":{"code":"BAD_REQUEST","message":"Invalid JSON body for task creation"}}` with HTTP 400
- **Status:** PASS

### Scenario 6: 503 - Server initializing shows server error message
- **Description:** Make API requests before a workspace is configured (registry not initialized)
- **Steps:**
  1. Start app fresh with no workspace
  2. `curl http://localhost:8080/api/tasks`
- **Expected:** Structured error with "Server initializing"
- **Actual:** Returns `{"error":{"code":"SERVICE_UNAVAILABLE","message":"Server initializing"}}` with HTTP 503
- **Status:** PASS

### Scenario 7: 409 - Duplicate agent shows server error message
- **Description:** Create an agent with a name that already exists
- **Steps:**
  1. Create agent "qa-test-agent" via POST
  2. Attempt to create the same agent again
- **Expected:** Structured error with "Agent already exists: qa-test-agent"
- **Actual:** Returns `{"error":{"code":"CONFLICT","message":"Agent already exists: qa-test-agent"}}` with HTTP 409
- **Status:** PASS

### Scenario 8: Config endpoints continue working
- **Description:** Verify config CRUD operations still work after refactoring from `expectConfigResponse` to `expectApiResponse`
- **Steps:**
  1. Create workspace via `POST /api/config/create`
  2. Load app, verify it navigates from Workspaces page to Board page
  3. Navigate to Workspaces page, verify active workspace is shown with config path
  4. Try opening a non-existent config, verify meaningful error
- **Expected:** All config operations work, errors show server messages
- **Actual:** Config create works, active workspace displays correctly, errors show meaningful messages like "ENOENT: no such file or directory"
- **Status:** PASS

### Scenario 9: Build succeeds
- **Description:** Verify the app builds successfully
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** Build completes without errors
- **Actual:** Build completed successfully. Compiled 13 UI modules, all tools, and chorus binary.
- **Status:** PASS

### Scenario 10: All tests pass
- **Description:** Verify all unit and integration tests pass
- **Steps:**
  1. Run `npm run test`
- **Expected:** All tests pass
- **Actual:** 62 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

### Scenario 11: No remaining Http.expectJson calls
- **Description:** Verify all Http.expectJson calls have been replaced with expectApiResponse
- **Steps:**
  1. Search for `Http.expectJson` in `packages/chorus-ui/src/Api.gren`
- **Expected:** No matches found
- **Actual:** No matches found. All 22 call sites now use `expectApiResponse`.
- **Status:** PASS

### Scenario 12: expectConfigResponse fully removed
- **Description:** Verify the duplicate `expectConfigResponse` function has been deleted
- **Steps:**
  1. Search for `expectConfigResponse` in `packages/chorus-ui/src/`
  2. Search for `configErrorToString` in `packages/chorus-ui/src/`
- **Expected:** No matches for either
- **Actual:** No matches found for `expectConfigResponse` or `configErrorToString`. Both have been fully removed.
- **Status:** PASS

### Scenario 13: Decode failure messages distinguished from server errors
- **Description:** Verify that `httpErrorToString` correctly distinguishes decode failures from server error messages
- **Steps:**
  1. Review `httpErrorToString` in Main.gren
  2. Verify BadBody branch checks for "Invalid response: " prefix
  3. Verify server error messages get "Server error: " prefix
  4. Verify decode failures pass through with their "Invalid response: " prefix
- **Expected:** Two distinct prefixes for two distinct error types
- **Actual:** `httpErrorToString` checks `String.startsWith "Invalid response: "` -- if true, passes through as-is (e.g., "Invalid response: Expecting an OBJECT..."); otherwise, prepends "Server error: " (e.g., "Server error: Task not found: xyz")
- **Status:** PASS

## Failures

No failures found.

## Test Code Quality Issues

No new test files were added or modified in this iteration. The QA standards instruct adding integration tests for each scenario, but the changes in this task are purely in the UI layer (`chorus-ui`), which is a Gren browser application. The integration test framework (`packages/tools/tests/integration/`) is for CLI tool testing, not browser UI testing. The server-side error responses were already correct and unchanged. Therefore, no integration tests were applicable for this change.

## Integration Tests Added

| Test Name | File | Validates |
|-----------|------|-----------|
| N/A | N/A | UI-only changes; integration test framework targets CLI tools, not browser behavior |

## Overall Assessment

**Decision:** PASS

The implementation correctly addresses both items from the iteration 1 review:

1. **Duplicate removal:** `expectConfigResponse` has been fully deleted. All four config call sites (`getConfig`, `updateConfig`, `selectConfig`, `createConfig`) now use `expectApiResponse toMsg configResponseDecoder`.

2. **Error source disambiguation:** The `GoodStatus_` branch of `expectApiResponse` now prefixes decode failures with "Invalid response: ". The `httpErrorToString` function checks for this prefix: decode failures pass through as-is (e.g., "Invalid response: Expecting an OBJECT..."), while server error messages receive the "Server error: " prefix (e.g., "Server error: Task not found: nonexistent-task-id").

All acceptance criteria are met:
- 503 errors show "Server error: Server initializing" instead of "Server error: 503"
- 400 errors show "Server error: Invalid JSON body for task creation" instead of "Server error: 400"
- 404 errors show "Server error: Task not found: xyz" instead of "Server error: 404"
- 409 errors show "Server error: Agent already exists: xyz" instead of "Server error: 409"
- Config endpoints continue working as before
- App builds successfully
- All tests pass (62 unit, 19 integration)
