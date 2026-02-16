# Developer Report

## Task
Add a workspace name input to the creation flow with auto-computed default path. Implement a `GET /api/config/defaults` backend endpoint, wire it through the Router, UI API module, and redesign the "New Workspace" section with a name field that auto-populates the path.

## Files Modified
- `packages/chorus/src/Web/Router.gren` - Added `GetConfigDefaults` route variant, parse rule for `GET /api/config/defaults`, and `routeToString` case
- `packages/chorus/src/Main.gren` - Added `handleGetConfigDefaults` handler using `FileSystem.homeDirectory` to return `<home>/Documents/ChorusWorkspaces`; wired the route into the request dispatcher (both the pre-registry config section and the exhaustive match in the registry section)
- `packages/chorus/tests/unit/RouterTests.gren` - Added `testGetConfigDefaultsRoute` test verifying `GET /api/config/defaults` parses to `GetConfigDefaults`
- `packages/chorus-ui/src/Api.gren` - Added `ConfigDefaultsResponse` type alias and `getConfigDefaults` function that calls the new endpoint and decodes the response
- `packages/chorus-ui/src/Main.gren` - Added model fields (`createName`, `defaultWorkspacePath`, `createPathManuallyEdited`, `nameValidationError`), new `Msg` variants (`GotConfigDefaults`, `UpdateCreateName`), update logic for auto-computing path from name with manual-edit decoupling and name validation, fetch defaults on init and WorkspacesPage load
- `packages/chorus-ui/src/View/Workspaces.gren` - Added new fields to `Config msg` type alias (`createName`, `defaultWorkspacePath`, `createPathManuallyEdited`, `nameValidationError`, `onUpdateCreateName`), redesigned `viewCreateWorkspace` to show a name input above the path input with validation error display

## Build Status
**Status:** PASS

```
Success! Compiled 13 modules. (chorus-ui)
Success! Compiled 5 modules. (tools)
Success! Compiled 24 modules. (chorus)
```

## Test Status
**Status:** PASS

```
Running 85 tests...
85 passed, 0 failed
```

## Implementation Notes
- The `handleGetConfigDefaults` handler uses `FileSystem.homeDirectory` which returns `Task x Path` (cannot fail), so the handler always succeeds. The path is converted via `Path.toPosixString` and appended with `/Documents/ChorusWorkspaces`.
- Name validation rejects `/`, `\`, and `..` characters. When validation fails, the path is not auto-computed (preserves the current path value). The validation error is displayed in the view below the name input.
- The `createPathManuallyEdited` flag is set to `True` whenever the user directly edits the path field. It resets to `False` when the name field is cleared entirely, allowing the user to "reset" the auto-compute behavior.
- When the default workspace path has not yet loaded (empty string), name changes do not overwrite the path field.
- The config defaults are fetched both on app init and when navigating to the WorkspacesPage, ensuring the path preview works immediately.
- The `GotConfigDefaults` error case is non-critical -- the user can still type a full path manually if the endpoint fails for any reason.

## Iteration
1
