# Flatten Workspace Directory Layout

## Summary
Remove the `data/` subdirectory layer so registry, providers, uploads, and conversations are stored directly in the workspace root alongside `chorus.json` and `agents/`. Remove the auto-created `agent_workspace` directory default — users must configure allowed directories themselves in system settings.

## Requirements
1. Remove the `dataDirectory` field from the `WorkspaceConfig` type, its encoder, and its decoder.
2. In `createWorkspaceConfig`, derive `providers/`, `registry/`, `uploads/`, and `conversations/` paths directly from `dirPath` (the workspace root) instead of `dirPath ++ "/data"`.
3. In `createWorkspaceConfig`, set `allowedAgentDirectories` to `[]` and `initialAgentDirectory` to `""` instead of defaulting to `agent_workspace`.
4. Stop creating the `data/` and `agent_workspace` directories during workspace creation.
5. Everywhere that reads `config.dataDirectory ++ "/registry"`, `config.dataDirectory ++ "/providers"`, `config.dataDirectory ++ "/uploads"`, `config.dataDirectory ++ "/conversations"` — derive these from the workspace root instead, using the parent directory of `chorus.json` (from `workspaceConfigPath` already in the model).
6. Update the UI to remove the "Data Directory" form field from System Settings.
7. Update the Workspaces view to remove the "Data Directory" info row.

## Acceptance Criteria
- [ ] `WorkspaceConfig` no longer has a `dataDirectory` field
- [ ] `encodeWorkspaceConfig` and `workspaceConfigDecoder` no longer include `dataDirectory`
- [ ] `createWorkspaceConfig` no longer creates `data/` or `agent_workspace` directories
- [ ] `createWorkspaceConfig` sets `allowedAgentDirectories = []` and `initialAgentDirectory = ""`
- [ ] Registry, providers, uploads, and conversations paths are derived from the workspace root (parent directory of `chorus.json`)
- [ ] The fallback `"./data/registry"` is updated to `"./registry"`
- [ ] System Settings UI no longer shows a "Data Directory" field
- [ ] Workspaces view no longer shows a "Data Directory" info row
- [ ] The placeholder text on the initial agent directory input no longer says `/path/to/agent_workspace`
- [ ] Application builds successfully with `npm run build:all`
- [ ] All tests pass with `npm run test`

## Out of Scope
- Migration of existing workspaces from old layout to new layout
- Changes to documentation files

## Technical Context

### Files to Modify
- `packages/shared/Types.gren` — Remove `dataDirectory` from `WorkspaceConfig` type, encoder, decoder
- `packages/chorus/src/Main.gren` — Update `createWorkspaceConfig`, `registryRootPath`, `uploadDir`, `makeProvider` conversations path, `GotConfigLoaded` handler, remove `agent_workspace` defaults, derive paths from workspace root
- `packages/chorus-ui/src/View/SystemSettings.gren` — Remove `dataDirectory` from `SettingsForm`, remove the Data Directory form field
- `packages/chorus-ui/src/View/Workspaces.gren` — Remove the Data Directory info row
- `packages/chorus-ui/src/Main.gren` — Remove `UpdateSettingsDataDirectory` message handling, remove `dataDirectory` from form construction, remove from save handler

### Design Decision
Use the existing `workspaceConfigPath` (already tracked in model) to derive the workspace root by stripping the filename from the path. This eliminates the need for a separate `dataDirectory` or `workspaceRoot` field.

### Patterns to Follow
- Follow existing path construction patterns using `++` for string concatenation
- Follow existing encoder/decoder patterns in Types.gren

## Testing Requirements
- Application builds with `npm run build:all`
- All tests pass with `npm run test`
- Creating a new workspace produces the flat directory structure (no `data/` or `agent_workspace` subdirectories)

## Notes
- No backwards compatibility needed — existing workspaces are not migrated
- The `allowedAgentDirectories` field remains in the config for system settings management, but defaults to empty instead of containing `agent_workspace`
