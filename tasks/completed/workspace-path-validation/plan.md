# Workspace Path Validation with Typed Status

## Summary

When a user creates a new workspace with a path that does not exist, the backend `createWorkspaceConfig` function can fail (e.g., filesystem error creating the directory), and the error is returned as a 400/500 HTTP response. However, the UI's `GotConfig` handler for the `Err` case simply sets `loading = False` and stays on the WorkspacesPage with no visible error message. The user has no indication of what went wrong.

Additionally, the workspace is currently modeled as `Maybe WorkspaceConfig` -- a simple presence/absence check. This task introduces a proper workspace status type that can represent "no workspace", "workspace opened", and "error opening workspace", and threads that type through both the backend API response and the UI.

## Current Problem Analysis

1. **Backend (`createWorkspaceConfig` in Main.gren, line 2397):** Attempts to create the directory with `FileSystem.makeDirectory` with `recursive = True`. If this fails (permissions issue, invalid path), the error propagates to `GotConfigLoaded` as `Err errMsg`, which sends a `sendBadRequest` response to the UI.
2. **UI (`GotConfig` handler in UI Main.gren, line 1296):** When `GotConfig` receives an `Err`, it sets `loading = False` and `page = WorkspacesPage` but does **not** set `model.error = Just ...`. The error is silently swallowed, leaving the user with no feedback.
3. **Navigation guard (line 1573):** The header checks `model.workspaceConfig /= Nothing` to enable/disable nav links. This works correctly because the config is `Nothing` when loading fails. But the UI gives no feedback about _why_ navigation is blocked.

## Requirements

1. Replace `Maybe WorkspaceConfig` model in the UI with a custom type that tracks workspace status: no workspace, opened, or error
2. When the backend returns an error for workspace creation/opening, display it in the UI on the Workspaces page
3. Only allow navigating to other tabs when workspace is in the "Opened" state
4. The backend `createWorkspaceConfig` should validate that the directory can be created and return a meaningful error if not
5. The Workspaces view should display the error message when workspace opening/creation fails

## Acceptance Criteria

- [ ] UI Model uses a `WorkspaceStatus` type instead of `Maybe WorkspaceConfig` -- variants: `NoWorkspace`, `Opened WorkspaceConfig String` (config + path), `WorkspaceError String` (error message)
- [ ] When workspace creation or opening fails, the error message from the backend is displayed in the Workspaces view
- [ ] Navigation links (Board, Agents, Providers, Settings) are only clickable when `WorkspaceStatus` is `Opened`
- [ ] The `WorkspaceError` state shows the error message inline in the Workspaces view (not just in the error banner)
- [ ] `npm run build:all` succeeds
- [ ] `npm run test` passes
- [ ] Creating a workspace with an invalid path (e.g., `/root/no-permission-dir`) shows a visible error in the UI

## Files to Modify

### Frontend
- `packages/chorus-ui/src/Main.gren` -- Replace `workspaceConfig : Maybe WorkspaceConfig` and `workspaceConfigPath : Maybe String` with `workspaceStatus : WorkspaceStatus`. Update `GotConfig` error branch to set `WorkspaceError errMsg`. Update all `model.workspaceConfig` checks to use the new type. Update header navigation guard.
- `packages/chorus-ui/src/View/Workspaces.gren` -- Update the `Config msg` type alias to accept `WorkspaceStatus` instead of `Maybe WorkspaceConfig` + `Maybe String`. Display error message when in `WorkspaceError` state.
- `packages/chorus-ui/src/View/SystemSettings.gren` -- Update references from `model.workspaceConfig` to extract from `WorkspaceStatus`.
- `packages/chorus-ui/src/Api.gren` -- Possibly update `ConfigResponse` if the error shape changes; but the current `Http.Error` already carries the backend error, so this may not need changes.

### Backend
- `packages/chorus/src/Main.gren` -- Ensure `createWorkspaceConfig` error messages are descriptive (they already are). Ensure `handleCreateConfig` and `handleSelectConfig` propagate meaningful error messages (they already do via `sendBadRequest`).

### Shared
- No changes needed to `packages/shared/Types.gren` since `WorkspaceStatus` is a UI-only concern.

## Out of Scope

- Changing the backend API response format (the current error propagation is sufficient)
- Validating workspace paths beyond filesystem access (e.g., no path syntax validation)
- Adding retry UI for failed workspace creation
- Modifying the backend `WorkspaceConfig` type in `packages/shared/Types.gren`

## Patterns to Follow

- The coding standard "Make Invalid States Unrepresentable" -- replacing `Maybe WorkspaceConfig` with a proper union type
- The existing pattern in `viewError` for displaying error messages
- The existing `GotConfig` handler pattern for success/failure branching

## Testing Requirements

- `npm run build:all` must succeed
- `npm run test` must pass
- Manual verification: start the app, enter an invalid directory path in the "New Workspace" form, verify the error is displayed in the UI
- Manual verification: after a workspace error, verify that navigation tabs are disabled
