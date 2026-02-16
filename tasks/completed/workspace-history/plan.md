# Workspace History

## Summary

Add a `workspaces.json` file that tracks previously opened workspaces, and display them in the Workspaces UI so users can click to reopen them without retyping paths.

## Requirements

- A `workspaces.json` file is created and maintained next to the Chorus binary (in `baseDir`)
- When a workspace is opened (select) or created, its path is recorded in `workspaces.json` with a timestamp
- The Workspaces page displays a "Recent Workspaces" list above the open/create forms
- Users can click a recent workspace entry to open it
- Users can remove entries from the recent workspaces list
- The existing "Open Workspace" and "New Workspace" forms remain unchanged
- If `workspaces.json` does not exist, the app treats it as an empty list (no error)

## Data Format

`workspaces.json` stored next to the binary (`baseDir/workspaces.json`):

```json
{
  "workspaces": [
    {
      "configPath": "/path/to/chorus.json",
      "lastOpenedAt": 1708000000000
    }
  ]
}
```

## Acceptance Criteria

1. `workspaces.json` is created in `baseDir` when the first workspace is opened or created
2. Opening an existing workspace via the path form adds it to `workspaces.json`
3. Creating a new workspace adds it to `workspaces.json`
4. Opening a workspace that already exists in the list updates its `lastOpenedAt` timestamp
5. `GET /api/workspaces` returns the list of recent workspaces sorted by most recently opened
6. `DELETE /api/workspaces?path=...` removes a workspace entry from the list
7. The Workspaces UI shows all recent workspaces when no workspace is active
8. Clicking a recent workspace entry opens it (same as typing its path and clicking Open)
9. A remove button on each entry removes it from the list
10. If `workspaces.json` does not exist, it is created automatically (empty list)
11. If `workspaces.json` exists but fails to read/parse, the error is displayed to the user

## Files to Modify

### Shared
- `packages/shared/Types.gren` — Add `WorkspaceEntry` type with `configPath : String` and `lastOpenedAt : Int`, plus encoder/decoder

### Backend (`packages/chorus/`)
- `src/Web/Router.gren` — Add `ListWorkspaces` and `RemoveWorkspace` routes
- `src/Main.gren` — Add `workspacesPath : String` to Model, handlers for new routes, update `handleSelectConfig`/`handleCreateConfig` to record workspace entries after successful open/create

### Frontend (`packages/chorus-ui/`)
- `src/Api.gren` — Add `getWorkspaces` and `removeWorkspace` API functions
- `src/Main.gren` — Add `recentWorkspaces : Array WorkspaceEntry` to model, new messages (`GotWorkspaces`, `RemoveWorkspace`, `WorkspaceRemoved`), update logic
- `src/View/Workspaces.gren` — Add "Recent Workspaces" section above the open/create forms, showing each entry with its path and a remove button
- `static/styles.css` — Styles for the recent workspaces list items

## Technical Notes

- File I/O follows the existing pattern in `loadWorkspaceConfig`/`saveWorkspaceConfig`
- Read `workspaces.json` on startup and cache in Model; update file on each open/create
- If file doesn't exist, create it with an empty list
- If file exists but fails to read/parse, surface the error to the user (don't silently ignore)
- Sort by `lastOpenedAt` descending (most recent first)
- When adding a workspace that already exists in the list, update its timestamp rather than creating a duplicate
