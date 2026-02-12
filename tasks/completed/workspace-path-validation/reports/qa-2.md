# QA Report

## Summary

All acceptance criteria pass. The iteration 2 changes correctly resolve the blocking issue from review 1 (404 responses overwriting `NoWorkspace` with `WorkspaceError`) and address all three suggestions (duplicate `isOpened` checks, unused helpers, misleading error prefix). Build succeeds, all 81 tests pass, and API-level testing confirms error messages propagate correctly from the backend.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify `npm run build:all` completes without errors
- **Steps:**
  1. Run `npm run build:all` in the worktree
- **Expected:** All components (UI, tools, chorus) compile and the dist is assembled
- **Actual:** Build completed successfully. UI compiled 12 modules, all tools compiled, chorus compiled 23 modules.
- **Status:** PASS

### Scenario 2: All tests pass
- **Description:** Verify `npm run test` passes all unit and integration tests
- **Steps:**
  1. Run `npm run test` in the worktree
- **Expected:** All tests pass with zero failures
- **Actual:** 62 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

### Scenario 3: Backend returns meaningful error for invalid workspace path
- **Description:** Creating a workspace at a path where the directory cannot be created returns a descriptive error
- **Steps:**
  1. Start the application
  2. POST to `/api/config/create` with `{"path":"/root/no-permission-dir"}`
- **Expected:** HTTP 400 response with a meaningful error message about why the directory could not be created
- **Actual:** Received `{"error":{"code":"BAD_REQUEST","message":"EROFS: read-only file system, mkdir '/root'"}}` with HTTP 400 status
- **Status:** PASS

### Scenario 4: Backend returns meaningful error for non-existent config file
- **Description:** Selecting a workspace config path that does not exist returns a descriptive error
- **Steps:**
  1. POST to `/api/config/select` with `{"path":"/nonexistent/path/chorus.json"}`
- **Expected:** HTTP 400 response with an error about the file not existing
- **Actual:** Received `{"error":{"code":"BAD_REQUEST","message":"ENOENT: no such file or directory, open '/nonexistent/path/chorus.json'"}}` with HTTP 400 status
- **Status:** PASS

### Scenario 5: Backend returns 404 when no workspace configured
- **Description:** GET `/api/config` returns 404 when no workspace is loaded
- **Steps:**
  1. Start app with no workspace configured
  2. GET `/api/config`
- **Expected:** 404 with "No workspace config loaded" message
- **Actual:** Received `{"error":{"code":"NOT_FOUND","message":"No workspace config loaded"}}` as expected
- **Status:** PASS

### Scenario 6: Workspace creation with valid path succeeds
- **Description:** Creating a workspace at a valid writable path succeeds and returns the config
- **Steps:**
  1. POST to `/api/config/create` with `{"path":"/tmp/chorus-test-workspace"}`
- **Expected:** HTTP 200 with the workspace config and config path
- **Actual:** Received 200 with `{"data":{"agentsDirectory":"/tmp/chorus-test-workspace/agents",...},"configPath":"/tmp/chorus-test-workspace/chorus.json"}`
- **Status:** PASS

### Scenario 7: WorkspaceStatus type replaces Maybe WorkspaceConfig
- **Description:** Verify the model uses the new `WorkspaceStatus` type with correct variants
- **Steps:**
  1. Review `packages/chorus-ui/src/WorkspaceStatus.gren`
  2. Review model definition in `packages/chorus-ui/src/Main.gren`
- **Expected:** `WorkspaceStatus` type with `NoWorkspace`, `WorkspaceOpened { config, configPath }`, `WorkspaceError String` variants; model uses `workspaceStatus : WorkspaceStatus`
- **Actual:** Type defined exactly as specified at line 17-20 of WorkspaceStatus.gren. Model uses `workspaceStatus : WorkspaceStatus` at line 81 of Main.gren. Init sets `workspaceStatus = NoWorkspace` at line 236.
- **Status:** PASS

### Scenario 8: GotConfig error handler sets WorkspaceError with clean message
- **Description:** When workspace creation/opening fails, `GotConfig Err` sets `WorkspaceError` with the server error message (without "Invalid response:" prefix)
- **Steps:**
  1. Review `GotConfig` Err handler at line 1355-1366
  2. Review `configErrorToString` at line 1979-1986
- **Expected:** Error handler uses `configErrorToString` which returns the `BadBody` message directly for config endpoint errors
- **Actual:** `configErrorToString` returns `BadBody message` directly (no prefix) and delegates to `httpErrorToString` for other variants. `GotConfig Err` uses this to set `workspaceStatus = WorkspaceError errorMessage`.
- **Status:** PASS

### Scenario 9: Navigation guard blocks access when workspace not opened
- **Description:** Navigation to Board, Agents, Providers, Settings redirects to Workspaces page when no workspace is opened
- **Steps:**
  1. Review `UrlChanged` handler at lines 340-377
  2. Review `requiresConfig` function at lines 1925-1935
  3. Review `viewHeader` navigation link rendering at lines 1609-1644
- **Expected:** Pages requiring config are redirected to WorkspacesPage. Header nav links render as disabled spans when workspace is not opened.
- **Actual:** `UrlChanged` checks `not (WorkspaceStatus.isOpened model.workspaceStatus) && requiresConfig requestedPage` and redirects to `WorkspacesPage`. `requiresConfig` returns `False` only for `WorkspacesPage` and `NotFoundPage`. `viewHeader` renders disabled `span` with `nav-disabled` class for non-enabled links.
- **Status:** PASS

### Scenario 10: Workspaces view renders error message inline
- **Description:** When `WorkspaceStatus` is `WorkspaceError`, the Workspaces view displays the error message inline
- **Steps:**
  1. Review `View/Workspaces.gren` lines 37-38 and 65-76
  2. Review CSS styling at `styles.css` lines 1022-1034
- **Expected:** Error message rendered in a styled error box with red text
- **Actual:** `viewWorkspaceError` renders `div.workspace-error > p.workspace-error-message` with the error text. CSS provides red background (`#fef2f2`), red border (`#fecaca`), dark red text (`#991b1b`). The "Open Workspace" and "New Workspace" forms are also shown below the error.
- **Status:** PASS

### Scenario 11: Blocking issue fix - loadPageData does not re-fetch config on WorkspacesPage
- **Description:** Navigating to WorkspacesPage should not fire `Api.getConfig`, preventing 404s from overwriting `NoWorkspace` with `WorkspaceError`
- **Steps:**
  1. Review `loadPageData` at lines 287-317
- **Expected:** `WorkspacesPage` case returns `Cmd.none` (no network request)
- **Actual:** `WorkspacesPage -> Cmd.none` at line 310-311. SystemSettingsPage also no longer fetches config (only fetches providers). The `pageLoadsData` helper correctly returns `False` for `WorkspacesPage`, preventing stuck loading states.
- **Status:** PASS

### Scenario 12: GotInitialConfig handles 404 as NoWorkspace
- **Description:** On initial page load, a 404 from the config endpoint is treated as "no workspace" (not an error)
- **Steps:**
  1. Review `GotInitialConfig` Err handler at lines 1321-1325
- **Expected:** Any error on initial load sets `NoWorkspace`, not `WorkspaceError`
- **Actual:** `GotInitialConfig Err _` sets `workspaceStatus = NoWorkspace` and `loading = False` with no error message. This correctly distinguishes "no workspace configured" from "workspace operation failed".
- **Status:** PASS

### Scenario 13: isOpened helper eliminates duplication
- **Description:** The `isOpened` helper in WorkspaceStatus module replaces duplicated pattern matching
- **Steps:**
  1. Review `WorkspaceStatus.isOpened` at lines 25-31
  2. Search for all uses of `isOpened` in Main.gren
- **Expected:** Single `isOpened` function used at all call sites instead of inline pattern matching
- **Actual:** `WorkspaceStatus.isOpened` used at line 345 (UrlChanged guard), line 1335 (GotConfig wasOpened check), and line 1613 (viewHeader configLoaded). No duplicate inline pattern matching remains.
- **Status:** PASS

## Failures

No failures found.

## Test Code Quality Issues

No new test files were added for this feature. This is acceptable because:
1. The feature is purely a UI model/view change (replacing `Maybe WorkspaceConfig` with `WorkspaceStatus` type)
2. The existing integration test framework tests tool-level JSON operations, not UI state management
3. There is no UI test framework in this project
4. The backend API behavior (returning errors for invalid paths) was already working -- the changes only affect how the frontend displays those errors

## Non-Blocking Observations

### Observation 1: SettingsSaved error handler still uses httpErrorToString
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1572
- **Description:** The `SettingsSaved` error handler uses `httpErrorToString err` instead of `configErrorToString err`. Since `updateConfig` now uses `expectConfigResponse`, BadBody errors from settings saves will display with the "Invalid response: " prefix. This was noted in review-2 as a non-blocking suggestion.
- **Impact:** MINOR -- only affects error messages when saving settings fails, which is an edge case not in the core scope of this task.

## Integration Tests Added

No integration tests were added. This feature modifies UI state management and view rendering only. The project's integration test framework is for tool-level JSON testing (file-read, file-write, etc.) and backend Gren tests, neither of which apply to Gren/Elm-architecture UI model changes. There is no browser-level UI testing framework in the project.

## Overall Assessment

**Decision:** PASS

All seven acceptance criteria are met:
1. `WorkspaceStatus` type with `NoWorkspace`, `WorkspaceOpened`, and `WorkspaceError` variants replaces `Maybe WorkspaceConfig`
2. Error messages from the backend are displayed in the Workspaces view when creation/opening fails
3. Navigation links are only clickable when workspace status is `WorkspaceOpened`
4. Error message is shown inline in the Workspaces view (not just the error banner)
5. `npm run build:all` succeeds
6. `npm run test` passes (62 unit + 19 integration)
7. Invalid path errors propagate meaningful messages from the backend

The blocking issue from iteration 1 (404 responses overwriting NoWorkspace with WorkspaceError) is fully resolved by removing unnecessary config re-fetch from `loadPageData`. All three review suggestions (isOpened helper, unused function cleanup, configErrorToString) are addressed correctly. The one remaining non-blocking item (SettingsSaved using httpErrorToString) was noted in review-2 and does not block this feature.
