# Developer Report

## Task
Implement workspace history feature: a `workspaces.json` file that tracks previously opened workspaces, with API endpoints to list and remove entries, and a "Recent Workspaces" section in the UI.

## Files Modified

### Shared
- `packages/shared/Types.gren` - Added `WorkspaceEntry` type alias with `configPath : String` and `lastOpenedAt : Int`, plus `encodeWorkspaceEntry` encoder and `workspaceEntryDecoder` decoder. Exported all three from the module.

### Backend (`packages/chorus/`)
- `src/Web/Router.gren` - Added `ListWorkspaces` (GET /api/workspaces) and `RemoveWorkspace String` (DELETE /api/workspaces?path=...) route variants, with corresponding parsing logic and `routeToString` cases.
- `src/Main.gren` - Multiple changes:
  - Added `workspacesPath : String` field to `Model` (stores `baseDir/workspaces.json` path)
  - Added `Time` import for timestamping workspace entries
  - Added `GotWorkspacesLoaded` and `GotWorkspaceRecorded` msg variants with handlers
  - Added route dispatch for `ListWorkspaces` and `RemoveWorkspace` in `handleRoute`
  - Added exhaustive match cases for new routes in the inner registry-guarded branch
  - Updated `GotConfigLoaded` success path to call `recordWorkspaceEntry` after every successful config load
  - Added handler functions: `handleListWorkspaces`, `handleRemoveWorkspace`
  - Added file I/O functions: `loadWorkspaceEntries`, `saveWorkspaceEntries`, `recordWorkspaceEntry`, `removeWorkspaceEntry`
  - `workspacesPath` initialized in `init` as `baseDir ++ "/workspaces.json"`

### Frontend (`packages/chorus-ui/`)
- `src/Api.gren` - Added `getWorkspaces` and `removeWorkspace` API functions. Exported both.
- `src/Main.gren` - Multiple changes:
  - Added `WorkspaceEntry` to Types import
  - Added `recentWorkspaces : Array WorkspaceEntry` to Model
  - Added `GotWorkspaces`, `OpenRecentWorkspace`, `RemoveRecentWorkspace`, `WorkspaceRemoved` msg variants
  - Added handlers for all four new messages
  - Fetches workspaces list on init, on page navigation to WorkspacesPage, and after successful config load
  - Optimistically removes entry from model on successful `WorkspaceRemoved`
  - Passes `recentWorkspaces`, `onOpenRecentWorkspace`, and `onRemoveRecentWorkspace` to Workspaces view
- `src/View/Workspaces.gren` - Rewritten to include:
  - Extended `Config msg` record with `recentWorkspaces`, `onOpenRecentWorkspace`, `onRemoveRecentWorkspace`
  - Added `viewRecentWorkspaces` function that renders the list above the open/create forms
  - Added `viewRecentWorkspaceEntry` with clickable path button and remove button
  - Recent workspaces section is hidden when the list is empty
  - Section appears in all workspace states (no workspace, active, error)

### Styles
- `packages/chorus-ui/static/styles.css` - Added styles for `.recent-workspaces-list`, `.recent-workspace-entry`, `.recent-workspace-path`, and `.recent-workspace-remove` with hover and disabled states

## Build Status
**Status:** PASS

All three components (UI, tools, chorus) compile successfully.

## Test Status
**Status:** PASS

77 passed, 0 failed

## Implementation Notes
- The `workspaces.json` file is stored next to the Chorus binary (`baseDir/workspaces.json`), where `baseDir` is the parent directory of the application binary path.
- If `workspaces.json` does not exist, `loadWorkspaceEntries` returns an empty array (checks for "ENOENT" in error string). Any other read error is surfaced.
- Recording a workspace entry is a read-modify-write operation: load existing entries, filter out any existing entry with the same path, add a new entry with the current timestamp, and write back. This avoids duplicates while updating timestamps.
- `recordWorkspaceEntry` is called on every successful `GotConfigLoaded` (both select and create paths, as well as startup with CHORUS_CONFIG). This means the workspace list is updated on startup too, not just on user-initiated opens.
- The `GET /api/workspaces` endpoint returns entries sorted by `lastOpenedAt` descending (most recent first).
- The `DELETE /api/workspaces?path=...` endpoint does not use URL encoding for the path parameter. File paths with `/` characters work correctly because they appear after the `?` in the query string. Paths containing `=` or `&` characters would not be handled correctly by the basic query string parser, but these are extremely unusual in file paths.
- The `GotWorkspaceRecorded` error case only logs the error (does not surface to user), since workspace recording is a background operation that should not block the workspace opening flow.

## Iteration
1
