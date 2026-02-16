# Developer Report

## Task
Fix the BLOCKER bug in `DELETE /api/workspaces?path=...` where file paths containing slashes in the query parameter value caused the route to resolve as `NotFound`. The root cause was that `parseRoute` split the URL on `/` before extracting query parameters, causing slashes in query values to be treated as path separators.

## Files Modified
- `packages/chorus/src/Web/Router.gren` - Replaced the `extractQueryParams` function (which operated on already-split segments) with `splitQueryString` (which splits the query string from the raw URL path before any `/`-splitting). Updated `parseRoute` to use the new function.
- `packages/chorus/tests/unit/RouterTests.gren` - New file with 7 unit tests covering the workspace routes and query parameter parsing, including the specific bug case of slashes in query parameter values.
- `packages/chorus/tests/unit/TestRunner.gren` - Added `RouterTests` to the test runner.

## Build Status
**Status:** PASS

All components (UI, tools, chorus) compiled successfully with no errors.

## Test Status
**Status:** PASS

84 passed, 0 failed (77 existing + 7 new router tests)

New tests added:
- `Router: GET /api/workspaces -> ListWorkspaces`
- `Router: DELETE /api/workspaces?path=test -> RemoveWorkspace "test"`
- `Router: DELETE /api/workspaces?path=/tmp/test/chorus.json -> RemoveWorkspace with full path`
- `Router: DELETE /api/workspaces?path=/home/user/projects/my-app/chorus.json -> RemoveWorkspace with deep path`
- `Router: DELETE /api/workspaces (no path param) -> NotFound`
- `Router: GET /api/tasks?status=pending -> ListTasks (Just "pending")`
- `Router: GET /api/tasks -> ListTasks Nothing`

## Implementation Notes
- The fix changes the order of operations in `parseRoute`: query string extraction now happens on the raw URL path string (before splitting on `/`), rather than on already-split segments (where slashes in query values had already corrupted the segment list).
- The new `splitQueryString` function uses `String.firstIndexOf "?" url` to find the first `?` character, then splits the URL into the path portion (before `?`) and the query string (after `?`). This ensures slashes in query parameter values like `/tmp/test/chorus.json` are never seen by the path splitter.
- The old `extractQueryParams` function, which looked for `?` only in the last segment of an already-split array, has been replaced entirely. No other code in the project referenced it.
- Existing query parameter behavior (e.g., `GET /api/tasks?status=pending`) continues to work correctly, as verified by the new tests.

## Iteration
3
