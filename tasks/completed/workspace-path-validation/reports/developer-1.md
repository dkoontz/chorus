# Developer Report

## Task
Replace `Maybe WorkspaceConfig` with a typed `WorkspaceStatus` custom type in the UI, display workspace errors inline in the Workspaces view, and extract meaningful backend error messages from failed config API responses.

## Files Modified
- `packages/chorus-ui/src/WorkspaceStatus.gren` - **New file.** Defines the `WorkspaceStatus` type with three variants: `NoWorkspace`, `WorkspaceOpened { config : WorkspaceConfig, configPath : String }`, and `WorkspaceError String`. Also provides `workspaceConfig` and `workspaceConfigPath` helper functions for extracting data from the status.
- `packages/chorus-ui/src/Main.gren` - Replaced `workspaceConfig : Maybe WorkspaceConfig` and `workspaceConfigPath : Maybe String` model fields with `workspaceStatus : WorkspaceStatus`. Added `GotInitialConfig` message variant for the initial load (errors silently become `NoWorkspace`) vs. user-initiated `GotConfig` (errors become `WorkspaceError`). Updated all pattern matches, construction sites, and navigation guards to use the new type.
- `packages/chorus-ui/src/View/Workspaces.gren` - Updated `Config msg` type alias to accept `workspaceStatus : WorkspaceStatus` instead of `Maybe WorkspaceConfig` + `Maybe String`. Added `viewWorkspaceError` function that renders the error message inline. The view now pattern matches on all three `WorkspaceStatus` variants.
- `packages/chorus-ui/src/Api.gren` - Added `expectConfigResponse` custom HTTP expect function that extracts error messages from the response body on `BadStatus_` responses (parsing `{ "error": { "message": "..." } }` JSON), rather than discarding the body as `Http.expectJson` does. Applied to all config API endpoints (`getConfig`, `selectConfig`, `createConfig`, `updateConfig`).
- `packages/chorus-ui/static/styles.css` - Added `.workspace-error` and `.workspace-error-message` CSS classes for the error display (red background, red text).

## Build Status
**Status:** PASS

```
Success! Compiled 12 modules.
    Main ───> build/app.js

(full build:all completed successfully including tools and chorus binaries)
```

## Test Status
**Status:** PASS

```
Running 62 tests...
62 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes
- **Gren variant parameter limit:** Gren 0.6.3 limits custom type variants to at most 1 parameter. The `WorkspaceOpened` variant uses a record `{ config : WorkspaceConfig, configPath : String }` instead of two separate parameters as the task spec originally suggested (`Opened WorkspaceConfig String`).
- **Variant naming:** Used `WorkspaceOpened` instead of `Opened` to avoid potential name collisions and improve clarity at pattern match sites. Similarly, the task spec suggested `WorkspaceError` which was kept as-is.
- **Split initial vs. user-initiated config loading:** Added a separate `GotInitialConfig` message for the config loaded on app startup (where a 404 is expected and should result in `NoWorkspace`, not an error). The `GotConfig` message is used for user-initiated operations (SelectConfig, CreateConfig) where errors should be displayed as `WorkspaceError`.
- **Error message extraction:** The standard `Http.expectJson` discards the response body on non-2xx status codes, returning only `BadStatus statusCode`. The new `expectConfigResponse` function uses `Http.expectStringResponse` to parse the backend error JSON body and extract the human-readable message. This means `httpErrorToString` will return the actual backend error message (via `BadBody "message"`) rather than a generic "Server error: 400".
- **SystemSettings.gren unchanged:** The `SystemSettings` module did not need changes because it receives a `Maybe SettingsForm` (already decomposed from the workspace status in Main.gren) rather than directly accessing the workspace config.
- **WorkspaceStatus module:** Created as a separate module to avoid circular dependencies between Main and View.Workspaces. Both can import it freely.

## Iteration
1
