# QA Report

## Summary

The workspace history feature is mostly functional: workspaces are recorded on open/create, displayed in the UI sorted by most recent, and clicking entries opens them. However, the `DELETE /api/workspaces?path=...` endpoint is completely broken for real file paths because the router's `parseRoute` function splits the URL on `/` before extracting query parameters, causing slashes in the path value to be treated as path separators. This makes acceptance criterion #6 (remove workspace entry) and #9 (remove button) non-functional for any real workspace path.

## Test Scenarios

### Scenario 1: Empty workspaces list on first run
- **Description:** Verify that `GET /api/workspaces` returns an empty list when `workspaces.json` does not exist
- **Steps:**
  1. Start the server with no `workspaces.json` file in `baseDir`
  2. Call `GET /api/workspaces`
- **Expected:** Response `{"data":[]}`
- **Actual:** Response `{"data":[]}` as expected
- **Status:** PASS

### Scenario 2: Open workspace records entry in workspaces.json
- **Description:** Verify that selecting an existing workspace via the Open Workspace form records it
- **Steps:**
  1. Navigate to the Workspaces page
  2. Enter `/tmp/chorus-qa-test-workspace/chorus.json` in the Open Workspace field
  3. Click Open
  4. Inspect `dist/workspaces.json` and `GET /api/workspaces`
- **Expected:** Entry with `configPath` and `lastOpenedAt` timestamp recorded
- **Actual:** `workspaces.json` created with correct entry; API returns it
- **Status:** PASS

### Scenario 3: Create workspace records entry in workspaces.json
- **Description:** Verify that creating a new workspace also records it in the recent list
- **Steps:**
  1. Navigate to the Workspaces page
  2. Enter `/tmp/chorus-qa-test-workspace-3` in the New Workspace field
  3. Click Create
  4. Call `GET /api/workspaces`
- **Expected:** New workspace appears in the list
- **Actual:** New workspace entry recorded and returned by the API
- **Status:** PASS

### Scenario 4: Re-opening a workspace updates its timestamp
- **Description:** Verify that opening a workspace already in the list updates its `lastOpenedAt` rather than creating a duplicate
- **Steps:**
  1. Open workspace-1, note its `lastOpenedAt` timestamp
  2. Wait 1 second, then re-open workspace-1 via `POST /api/config/select`
  3. Check the `lastOpenedAt` timestamp
- **Expected:** Timestamp updated, no duplicate entry
- **Actual:** Timestamp changed from `1771199519978` to `1771199647974`; single entry, no duplicates
- **Status:** PASS

### Scenario 5: Workspaces sorted by most recently opened
- **Description:** Verify `GET /api/workspaces` returns entries sorted by `lastOpenedAt` descending
- **Steps:**
  1. Open workspace-1, then open workspace-2
  2. Call `GET /api/workspaces`
- **Expected:** Workspace-2 (opened later) appears first
- **Actual:** Workspace-2 returned first in the array
- **Status:** PASS

### Scenario 6: UI displays recent workspaces above open/create forms
- **Description:** Verify the "Recent Workspaces" section appears in the Workspaces page UI
- **Steps:**
  1. Open a workspace
  2. Navigate to the Workspaces page
- **Expected:** "Recent Workspaces" section visible above the Open/Create forms, showing the workspace path and a remove button
- **Actual:** Section displayed correctly with path and remove (x) button; hidden when list is empty
- **Status:** PASS

### Scenario 7: Clicking a recent workspace opens it
- **Description:** Verify that clicking a workspace entry in the recent list opens it
- **Steps:**
  1. Have two workspaces recorded; workspace-2 is currently active
  2. Click on workspace-1 in the Recent Workspaces list
- **Expected:** Workspace-1 becomes the active workspace; its timestamp is updated; list re-sorts
- **Actual:** Workspace-1 opens successfully; Active Workspace shows its path; list re-sorts with workspace-1 first
- **Status:** PASS

### Scenario 8: Remove workspace entry via UI
- **Description:** Verify that clicking the remove button removes an entry from the recent list
- **Steps:**
  1. Have a workspace entry in the recent list
  2. Click the remove (x) button on the entry
- **Expected:** Entry removed from list and from `workspaces.json`
- **Actual:** Error notification: "Failed to remove workspace: Server error: Endpoint not found". The entry remains in the list.
- **Status:** FAIL

### Scenario 9: Remove workspace via API (path with slashes)
- **Description:** Verify `DELETE /api/workspaces?path=/tmp/chorus-qa-test-workspace/chorus.json` works
- **Steps:**
  1. Call `DELETE /api/workspaces?path=/tmp/chorus-qa-test-workspace/chorus.json`
- **Expected:** 200 response, entry removed
- **Actual:** 404 Not Found. The server log shows `DELETE /api/workspaces?path=/tmp/chorus-qa-test-workspace/chorus.json -> NotFound`
- **Status:** FAIL

### Scenario 10: Remove workspace via API (path without slashes)
- **Description:** Verify `DELETE /api/workspaces?path=test` works for a simple value
- **Steps:**
  1. Call `DELETE /api/workspaces?path=test`
- **Expected:** 200 response
- **Actual:** 200 response `{"data":{}}`
- **Status:** PASS

### Scenario 11: Error displayed when workspaces.json is malformed
- **Description:** Verify that a corrupted `workspaces.json` file surfaces an error to the user
- **Steps:**
  1. Overwrite `workspaces.json` with invalid content: `this is not valid json`
  2. Navigate to Workspaces page (which triggers `GET /api/workspaces`)
- **Expected:** Error notification displayed to the user with parse error details
- **Actual:** Red error banner shown: "Failed to load recent workspaces: Server error: Invalid workspaces JSON: Problem with the given value: ..."
- **Status:** PASS

### Scenario 12: Existing Open/Create forms unchanged
- **Description:** Verify the existing Open Workspace and New Workspace forms still work as before
- **Steps:**
  1. Navigate to Workspaces page
  2. Verify both forms are present with their original fields and buttons
- **Expected:** Both forms present and functional
- **Actual:** Both forms present; Open form successfully opens workspaces; Create form successfully creates new workspaces
- **Status:** PASS

## Failures

### Failure 1: DELETE /api/workspaces fails for any real file path containing slashes
- **Scenario:** Scenarios 8 and 9
- **Reproduction Steps:**
  1. Start the server
  2. Open a workspace so it gets recorded (e.g., `/tmp/test/chorus.json`)
  3. Attempt to remove it: `curl -X DELETE "http://localhost:8080/api/workspaces?path=/tmp/test/chorus.json"`
  4. Observe 404 response
- **Expected Behavior:** The entry is removed and a 200 response is returned
- **Actual Behavior:** The server returns `{"error":{"code":"NOT_FOUND","message":"Endpoint not found"}}` with HTTP 404. The server log shows the route resolved to `NotFound`.
- **Root Cause:** In `packages/chorus/src/Web/Router.gren`, the `parseRoute` function (line 74-78) splits the URL path on `/` BEFORE extracting query parameters. For the URL `/api/workspaces?path=/tmp/test/chorus.json`, the split produces segments `["api", "workspaces?path=", "tmp", "test", "chorus.json"]`. The `extractQueryParams` function only looks for `?` in the LAST segment (`"chorus.json"`), which has none, so the full array becomes the path segments. This does not match the expected pattern `{ method = DELETE, segments = [ "api", "workspaces" ] }`, causing the route to resolve as `NotFound`. This means the remove feature is broken for ALL real file paths (which always contain `/`).
- **Severity:** BLOCKER

## Test Code Quality Issues

No test files were added or modified in this feature. The existing 77 unit tests all pass, but there are no tests covering the workspace history functionality (API endpoints, JSON serialization, file I/O, or routing of the new endpoints).

### Issue 1: No tests for workspace history routes
- **File:** `packages/chorus/src/Web/Router.gren`
- **Line:** 203-212
- **Problem:** The new `ListWorkspaces` and `RemoveWorkspace` routes have no unit tests. A test for `parseRoute DELETE "/api/workspaces?path=/tmp/test/chorus.json"` would have caught the blocker bug.
- **Suggestion:** Add unit tests for the new routes in the Router test suite, including paths with slashes in query parameter values.

### Issue 2: No tests for WorkspaceEntry encoder/decoder round-trip
- **File:** `packages/shared/Types.gren`
- **Line:** 1585-1610
- **Problem:** The `encodeWorkspaceEntry` and `workspaceEntryDecoder` functions have no round-trip tests.
- **Suggestion:** Add a test verifying that encoding then decoding a `WorkspaceEntry` produces the original value.

## Integration Tests Added

No integration tests were added. The integration test framework (`packages/tools/tests/integration/`) is designed for file tool operations and does not apply to HTTP API endpoint testing. The workspace history feature would benefit from API-level integration tests, but no such test infrastructure exists in the project.

## Overall Assessment

**Decision:** FAIL

The remove workspace feature (acceptance criteria #6 and #9) is completely broken due to a bug in the URL router. The `parseRoute` function in `packages/chorus/src/Web/Router.gren` splits the URL on `/` before extracting query parameters, which causes any query parameter value containing `/` characters (i.e., every real file path) to be misinterpreted as additional path segments. This results in the `DELETE /api/workspaces?path=...` route never matching.

Blocking issues that must be resolved:
1. Fix the `parseRoute` function in `packages/chorus/src/Web/Router.gren` to extract the query string from the raw URL path BEFORE splitting on `/`. The current approach of splitting on `/` first and then looking for `?` only in the last segment breaks whenever a query parameter value contains slashes.
