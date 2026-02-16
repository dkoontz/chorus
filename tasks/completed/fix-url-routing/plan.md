# Fix URL Routing So Page Refresh Preserves the Current Route

## Problem

URL routing only works inconsistently. Navigating to a task URL like `http://localhost:8080/tasks/d8a86d1a-f8d3-471d-95d3-82f88010fe0f` and then refreshing shows the board view instead of the task detail view. The initial URL is not being parsed and used to determine the starting page.

## Root Cause

The bug is entirely client-side in `packages/chorus-ui/src/Main.gren`:

1. **`init` ignores the initial URL**: The `init` function receives the initial `url` parameter but only uses it for WebSocket URL derivation. The `page` field is hardcoded to `WorkspacesPage` (line 265).

2. **`GotInitialConfig` always navigates to `BoardPage`**: When config loads successfully (line 1392), the handler checks `if model.page == WorkspacesPage` and unconditionally redirects to `BoardPage` — never consulting the original URL.

The server-side SPA fallback in `Web.Static` already works correctly (serves `index.html` for non-file paths), so no server changes are needed.

## Fix

1. Add an `initialUrl` field (type `Url`) to the `Model` to remember the URL that was requested on first load
2. Modify `init` to store the initial URL in the model
3. Modify the `GotInitialConfig` handler to:
   - Parse the stored `initialUrl` using `urlToPage`
   - Navigate to the parsed page instead of always `BoardPage`
   - Fall back to `BoardPage` if the initial URL resolves to `WorkspacesPage` or root `/`
   - Load the correct page data for the intended page

## Files to Modify

- `packages/chorus-ui/src/Main.gren` — add `initialUrl` field to `Model`, update `init`, update `GotInitialConfig`

## Acceptance Criteria

- Navigating to `http://localhost:8080/tasks/{taskId}` and refreshing shows the task detail view
- Navigating to `http://localhost:8080/agents` and refreshing shows the agents page
- Navigating to `http://localhost:8080/providers` and refreshing shows the providers page
- Navigating to `http://localhost:8080/settings` and refreshing shows the settings page
- Navigating to `http://localhost:8080/` still shows the board (current behavior preserved)
- When no workspace is configured, config-requiring routes still redirect to the workspaces page
