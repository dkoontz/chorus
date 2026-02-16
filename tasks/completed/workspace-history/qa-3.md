# QA Report

## Summary

The BLOCKER from QA-2 (DELETE /api/workspaces route broken for paths with slashes) has been fully resolved. The developer restructured `parseRoute` to extract the query string before splitting on `/`, and added 7 comprehensive unit tests. All 12 test scenarios pass, including the previously-broken remove workspace functionality via both the API and the UI.

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
- **Description:** Verify that selecting an existing workspace via `POST /api/config/select` records it
- **Steps:**
  1. Call `POST /api/config/select` with `{"path":"/tmp/chorus-qa-test-workspace/chorus.json"}`
  2. Check `dist/workspaces.json` and `GET /api/workspaces`
- **Expected:** Entry with `configPath` and `lastOpenedAt` timestamp recorded
- **Actual:** `workspaces.json` created with correct entry; API returns it with correct `configPath` and numeric `lastOpenedAt`
- **Status:** PASS

### Scenario 3: Create workspace records entry in workspaces.json
- **Description:** Verify that creating a new workspace also records it in the recent list
- **Steps:**
  1. Call `POST /api/config/create` with `{"path":"/tmp/chorus-qa-test-workspace-3"}`
  2. Call `GET /api/workspaces`
- **Expected:** New workspace appears in the list
- **Actual:** New workspace entry recorded and returned by the API
- **Status:** PASS

### Scenario 4: Re-opening a workspace updates its timestamp
- **Description:** Verify that opening a workspace already in the list updates its `lastOpenedAt` rather than creating a duplicate
- **Steps:**
  1. Open workspace-1, note its `lastOpenedAt` timestamp (1771200399918)
  2. Wait 1 second, then re-open workspace-1 via `POST /api/config/select`
  3. Check the `lastOpenedAt` timestamp and entry count
- **Expected:** Timestamp updated, no duplicate entry
- **Actual:** Timestamp changed from 1771200399918 to 1771200412579; single entry, no duplicates
- **Status:** PASS

### Scenario 5: Workspaces sorted by most recently opened
- **Description:** Verify `GET /api/workspaces` returns entries sorted by `lastOpenedAt` descending
- **Steps:**
  1. Open workspace-1, then open workspace-2
  2. Re-open workspace-1
  3. Call `GET /api/workspaces`
- **Expected:** Workspace-1 (re-opened last) appears first
- **Actual:** Workspace-1 returned first in the array
- **Status:** PASS

### Scenario 6: UI displays recent workspaces above open/create forms
- **Description:** Verify the "Recent Workspaces" section appears in the Workspaces page UI
- **Steps:**
  1. Open two workspaces via API
  2. Navigate to the Workspaces page in the browser
- **Expected:** "Recent Workspaces" section visible above the Open/Create forms, showing workspace paths and remove (x) buttons
- **Actual:** Section displayed correctly with paths and remove (x) buttons; "Active Workspace" shown at top; "Open Workspace" and "New Workspace" forms below
- **Status:** PASS

### Scenario 7: Clicking a recent workspace opens it
- **Description:** Verify that clicking a workspace entry in the recent list opens it
- **Steps:**
  1. Have two workspaces recorded; workspace-2 is currently active
  2. Click on workspace-1 in the Recent Workspaces list
- **Expected:** Workspace-1 becomes the active workspace; its timestamp is updated; list re-sorts
- **Actual:** Active Workspace changed from workspace-2 to workspace-1; list re-sorted with workspace-1 first
- **Status:** PASS

### Scenario 8: Remove workspace entry via UI (BLOCKER RETEST)
- **Description:** Verify that clicking the remove (x) button removes an entry from the recent list
- **Steps:**
  1. Have a workspace entry in the recent list (`/tmp/chorus-qa-test-workspace/chorus.json`)
  2. Click the remove (x) button on the entry
- **Expected:** Entry removed from list; no error notification
- **Actual:** Entry removed from list immediately; "Recent Workspaces" section hidden (empty list); no error notification; `workspaces.json` updated to `{"workspaces":[]}`
- **Status:** PASS

### Scenario 9: Remove workspace via API with slashes in path (BLOCKER RETEST)
- **Description:** Verify `DELETE /api/workspaces?path=/tmp/chorus-qa-test-workspace-3/chorus.json` works
- **Steps:**
  1. Call `DELETE /api/workspaces?path=/tmp/chorus-qa-test-workspace-3/chorus.json`
- **Expected:** 200 response with `{"data":{}}`
- **Actual:** HTTP 200, body `{"data":{}}`, entry removed from workspaces list
- **Status:** PASS

### Scenario 10: Remove workspace via API with deeply nested path
- **Description:** Verify DELETE works for a deeply nested path with many slashes
- **Steps:**
  1. Call `DELETE /api/workspaces?path=/home/user/projects/deep/nested/path/to/chorus.json`
- **Expected:** 200 response
- **Actual:** HTTP 200, body `{"data":{}}`
- **Status:** PASS

### Scenario 11: Remove workspace via API with no path param
- **Description:** Verify DELETE without a path parameter returns 404
- **Steps:**
  1. Call `DELETE /api/workspaces` (no query parameter)
- **Expected:** 404 response
- **Actual:** HTTP 404, body `{"error":{"code":"NOT_FOUND","message":"Endpoint not found"}}`
- **Status:** PASS

### Scenario 12: Error displayed when workspaces.json is malformed
- **Description:** Verify that a corrupted `workspaces.json` file surfaces an error to the user
- **Steps:**
  1. Overwrite `workspaces.json` with invalid content: `this is not valid json`
  2. Call `GET /api/workspaces`
- **Expected:** Error response with parse error details
- **Actual:** HTTP 500, body includes `{"error":{"code":"READ_ERROR","message":"Invalid workspaces JSON: Problem with the given value: ... This is not valid JSON!"}}`
- **Status:** PASS

### Scenario 13: Remove workspace via UI for entry with slashes (BLOCKER RETEST)
- **Description:** Verify that clicking the remove (x) button works for a workspace path containing slashes (the exact bug from QA-2)
- **Steps:**
  1. Have `/tmp/chorus-qa-test-workspace-2/chorus.json` in the recent list
  2. Click its remove (x) button in the UI
- **Expected:** Entry removed; no error notification
- **Actual:** Entry removed immediately; remaining entry stays in list; no error notification
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

### Issue 1: parseQueryString silently drops values containing `=`
- **File:** `packages/chorus/src/Web/Router.gren`
- **Line:** 276-278
- **Problem:** The `parseQueryString` function uses `String.split "=" pair` and only matches a 2-element array `[key, value]`. If a query parameter value contains `=` (e.g., `?key=val=ue`), `String.split` produces 3 elements, which falls through to the catch-all and the parameter is silently dropped. This does not currently affect workspace history (file paths do not contain `=`) but could cause issues if query parameters with `=` in values are added in the future.
- **Suggestion:** Use `String.firstIndexOf "="` to split only on the first `=` (mirroring how `splitQueryString` handles `?`), or add a test documenting the current behavior as intentional.

### Issue 2: No round-trip test for WorkspaceEntry encoder/decoder
- **File:** `packages/shared/Types.gren`
- **Line:** 1591-1610
- **Problem:** The `encodeWorkspaceEntry` and `workspaceEntryDecoder` functions have no round-trip tests verifying that encoding then decoding produces the original value.
- **Suggestion:** Add a test verifying encode/decode round-trip for `WorkspaceEntry`.

## Integration Tests Added

No integration tests were added. The integration test framework (`packages/tools/tests/integration/`) is designed for file tool operations and does not have infrastructure for HTTP API endpoint testing. The workspace history feature's API endpoints are tested via unit tests on the router and through manual functional testing documented above.

## Unit Tests

84 tests pass (77 existing + 7 new router tests). The new tests are:

| Test Name | File | Validates |
| --- | --- | --- |
| Router: GET /api/workspaces -> ListWorkspaces | `RouterTests.gren` | GET route matches ListWorkspaces |
| Router: DELETE /api/workspaces?path=test -> RemoveWorkspace "test" | `RouterTests.gren` | DELETE with simple path param |
| Router: DELETE /api/workspaces?path=/tmp/test/chorus.json -> RemoveWorkspace with full path | `RouterTests.gren` | DELETE with slashes in query value (the bug case) |
| Router: DELETE /api/workspaces?path=/home/user/projects/my-app/chorus.json -> RemoveWorkspace with deep path | `RouterTests.gren` | DELETE with deeply nested path |
| Router: DELETE /api/workspaces (no path param) -> NotFound | `RouterTests.gren` | Missing path param returns NotFound |
| Router: GET /api/tasks?status=pending -> ListTasks (Just "pending") | `RouterTests.gren` | Existing query param behavior preserved |
| Router: GET /api/tasks -> ListTasks Nothing | `RouterTests.gren` | Existing no-query behavior preserved |

## Overall Assessment

**Decision:** PASS

The BLOCKER from QA-2 has been fully resolved. The root cause (splitting URL on `/` before extracting query parameters) was fixed by restructuring `parseRoute` to use a new `splitQueryString` function that extracts the query string from the raw URL before any path splitting. The fix is clean, well-documented in code comments, and covered by 7 new unit tests that specifically target the bug case (slashes in query parameter values). All 13 test scenarios pass, including the previously-broken remove workspace functionality via both the API and the browser UI. The existing Open/Create workspace forms and all other routes continue to function correctly.

Non-blocking observations:
1. `parseQueryString` silently drops query parameter values containing `=` (does not affect this feature but could be a future issue)
2. No round-trip test for `WorkspaceEntry` encoder/decoder
