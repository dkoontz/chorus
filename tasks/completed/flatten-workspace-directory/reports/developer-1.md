# Developer Report

## Task
Flatten workspace directory layout by removing the `data/` subdirectory layer. Registry, providers, uploads, and conversations are now stored directly in the workspace root alongside `chorus.json`. Removed the auto-created `agent_workspace` directory default.

## Files Modified
- `packages/shared/Types.gren` - Removed `dataDirectory` field from `WorkspaceConfig` type, encoder (`encodeWorkspaceConfig`), and decoder (`workspaceConfigDecoder`). Changed decoder from `Decode.map5` to `Decode.map4`.
- `packages/chorus/src/Main.gren` - Added `workspaceRoot` helper that derives the workspace root from `workspaceConfigPath` by stripping the filename. Updated `registryRootPath` and `uploadDir` to use `workspaceRoot` instead of `config.dataDirectory`. Updated `GotConfigLoaded` handler to derive `registryRoot`, `providersRoot`, and `uploadDirPath` from workspace root. Updated `conversationsDir` in `makeProvider` to derive from `workspaceConfigPath`. Updated tool execution fallback from `"./data/registry"` to `"./registry"`. Updated `createWorkspaceConfig` to set `allowedAgentDirectories = []` and `initialAgentDirectory = ""`, and to stop creating `data/` and `agent_workspace` directories. Updated backend validation in `handleUpdateConfig` to allow empty `initialAgentDirectory`.
- `packages/chorus-ui/src/View/SystemSettings.gren` - Removed `dataDirectory` from `SettingsForm` type. Removed `dataDirectory` from `workspaceConfigToForm`. Removed `onUpdateDataDirectory` from `Config` type. Removed the Data Directory form field from the settings view. Updated initial agent directory placeholder from `/path/to/agent_workspace` to `/path/to/working/directory`.
- `packages/chorus-ui/src/View/Workspaces.gren` - Removed the Data Directory info row from the active workspace view.
- `packages/chorus-ui/src/Main.gren` - Removed `UpdateSettingsDataDirectory` message variant and its handler. Removed `onUpdateDataDirectory` from SystemSettings.view call. Removed `dataDirectory` from the `wc` record construction in `SaveSettings`. Updated UI-side validation to allow empty `initialAgentDirectory` (bypasses the "must be in allowed dirs" check when empty).

## Build Status
**Status:** PASS

Build completed successfully with `npm run build:all`. All three packages (chorus-ui, tools, chorus) compiled without errors.

## Test Status
**Status:** PASS

- 46 unit tests passed, 0 failed
- 19 integration tests passed, 0 failed

## Implementation Notes
- The workspace root is derived by splitting the `workspaceConfigPath` on `/` and dropping the last segment (the filename). This avoids adding a new field to the model since `workspaceConfigPath` is already tracked.
- The same path-stripping logic is duplicated in a few places in `GotConfigLoaded`, `conversationsDir`, and the tool execution fallback because each runs before the model is updated with the new config. The `workspaceRoot` helper is used for the `registryRootPath` and `uploadDir` functions that read from the already-stored model.
- The validation for `initialAgentDirectory` being in `allowedAgentDirectories` was updated in both the UI and backend to allow an empty `initialAgentDirectory`, since the new defaults set it to `""` with an empty allowed list.

## Iteration
1
