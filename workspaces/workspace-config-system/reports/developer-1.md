# Developer Report: Workspace Config System

## Summary

Implemented the workspace config system feature for Chorus, replacing environment-variable-based configuration with a file-based `chorus.json` workspace config. Added Workspaces and System Settings tabs to the UI, deferred all registry initialization until config is loaded, replaced per-task workspace isolation with shared allowed directories, and made the system agent provider configurable.

## Changes Made

### Shared Types (`packages/shared/Types.gren`)
- Added `WorkspaceConfig` type alias with fields: `dataDirectory`, `agentsDirectory`, `allowedAgentDirectories`, `initialAgentDirectory`, `systemAgentProvider`
- Added `AgentProvider` type: `NotConfigured | ProviderRef String`
- Added `encodeWorkspaceConfig`, `workspaceConfigDecoder`, `encodeAgentProvider`, `agentProviderDecoder`

### Config Module (`packages/chorus/src/Config.gren`)
- Removed `workspacesRoot`, `registryRoot`, `agentsRoot`, `providersRoot`, `uploadDir` from `Config` type
- Removed `CHORUS_DATA_DIR` env var support
- Added `chorusConfigPath : Maybe String` field (from `CHORUS_CONFIG` env var)
- Kept env vars: `CHORUS_HOST`, `CHORUS_PORT`, `CHORUS_STATIC_DIR`, `CHORUS_LOG_LEVEL`, `CHORUS_TOOLS_PATH`

### Backend Main (`packages/chorus/src/Main.gren`)
- Added `workspaceConfig : Maybe WorkspaceConfig` and `workspaceConfigPath : Maybe String` to Model
- Added `GotConfigLoaded` Msg variant that initializes all registries from workspace config paths
- Deferred ALL registry initialization (task, agent, provider) until config is loaded
- Added config API route handlers: `handleGetConfig`, `handleUpdateConfig`, `handleSelectConfig`, `handleCreateConfig`
- Config routes handled before registry check (they work without a loaded workspace)
- Added helper functions: `registryRootPath`, `uploadDir`, `initialAgentDir`, `loadWorkspaceConfig`, `saveWorkspaceConfig`, `createWorkspaceConfig`
- Replaced hardcoded ClaudeCode system agent provider with configurable lookup from workspace config's `systemAgentProvider` field
- Agent spawn now uses `initialAgentDirectory` instead of per-task workspace
- File tools receive `allowedDirectories` from workspace config instead of a single workspace root
- Auto-loads config from `CHORUS_CONFIG` env var at startup

### Router (`packages/chorus/src/Web/Router.gren`)
- Added routes: `GetConfig`, `UpdateConfig`, `SelectConfig`, `CreateConfig`

### Tool Execution (`packages/chorus/src/Web/ToolExecution.gren`)
- Changed `ToolExecutionContext.workspaceRoot : String` to `allowedDirectories : Array String`
- Updated `dispatchFileTool` to pass allowed directories

### Tools Validation (`packages/tools/src/Tools/Validation.gren`)
- Renamed `WorkspaceRoot` opaque type to `AllowedDirectories`
- `makeWorkspaceRoot` replaced by `makeAllowedDirectories` (takes `Array String`)
- `validatePath` now checks against any of the allowed directories
- Added `NoAllowedDirectories` error variant and `allowedDirectoryPaths` accessor

### Tools File (`packages/tools/src/Tools/File.gren`)
- All functions updated to accept `AllowedDirectories` instead of `WorkspaceRoot`
- Working directory for child processes uses first allowed directory

### Tool CLI Mains (`FileToolsMain.gren`, `CombinedMain.gren`)
- Updated to use `AllowedDirectories` and `makeAllowedDirectories`

### Task Registry (`packages/chorus/src/Task/Registry.gren`)
- Removed `workspacesRoot : Path` from Registry type
- `init` now takes `{ registryRoot : String }` only
- Removed per-task workspace directory creation

### UI API Client (`packages/chorus-ui/src/Api.gren`)
- Added `ConfigResponse` type and `configResponseDecoder`
- Added functions: `getConfig`, `updateConfig`, `selectConfig`, `createConfig`
- Exposed `ConfigResponse` type

### UI Main (`packages/chorus-ui/src/Main.gren`)
- Added `WorkspacesPage` and `SystemSettingsPage` to `Page` type
- Added workspace config state: `workspaceConfig`, `workspaceConfigPath`, `openPath`, `createPath`, `settingsForm`, `settingsValidationError`
- Added Msg variants for config operations and system settings editing
- On init, loads config via `GET /api/config`; if no config, stays on WorkspacesPage
- Tabs (Board, Agents, Providers, Settings) disabled when no config loaded
- Navigation redirects to WorkspacesPage when config not loaded
- Settings validation: initial agent directory must be in allowed directories

### New View: Workspaces (`packages/chorus-ui/src/View/Workspaces.gren`)
- Shows active workspace info when config loaded
- "Open Workspace" form: text input for chorus.json path + Open button
- "New Workspace" form: text input for directory path + Create button

### New View: System Settings (`packages/chorus-ui/src/View/SystemSettings.gren`)
- Editable fields for all `chorus.json` settings
- Allowed agent directories list with add/remove buttons
- System agent provider dropdown populated from provider registry
- Save button with validation
- `workspaceConfigToForm` helper for converting config to form state

### CSS (`packages/chorus-ui/static/styles.css`)
- Added styles for disabled nav links (`.nav-disabled`)
- Added styles for workspaces page, workspace sections, form rows, info rows
- Added styles for system settings page, allowed directories list, validation errors

### Tests
- Updated `ConfigTests.gren`: removed tests for removed fields, added CHORUS_CONFIG env var tests
- Updated `ValidationTests.gren`: uses `AllowedDirectories`/`makeAllowedDirectories`
- Updated `IntegrationRunner.gren`: removed `workspacesRoot` from `Registry.init`, removed workspace directory assertion

## Test Results

- Unit tests: 46 passed, 0 failed
- Integration tests: 19 passed, 0 failed
- Build: `npm run build:all` succeeds

## Acceptance Criteria Status

- [x] A new `chorus.json` file can be created at a user-specified directory via the UI
- [x] An existing `chorus.json` file can be loaded via the UI by entering its path
- [x] When no workspace is loaded, only the Workspaces tab is accessible; other tabs are disabled
- [x] Loading or creating a workspace enables all tabs
- [x] The System Settings tab displays all settings from the loaded `chorus.json` and allows editing
- [x] Saving in System Settings persists changes to the `chorus.json` file on disk
- [x] Initial agent directory must be one of the allowed agent directories (validated in UI)
- [x] `CHORUS_CONFIG` env var pre-loads a config file at startup
- [x] All registries defer initialization until workspace config is loaded
- [x] Provider registry root derives from workspace config data directory
- [x] Agents spawn with the initial agent directory as their working directory
- [x] File tools validate paths against the allowed agent directories
- [x] Per-task workspace directories are no longer created
- [x] System agent provider setting is configurable in System Settings tab
- [x] Internal agents use the system agent provider from workspace config
- [x] If system agent provider is NotConfigured, operations return a descriptive error
- [x] The app builds successfully
- [x] Existing unit tests pass or are updated
