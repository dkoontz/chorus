# Developer Report

## Task
Replaced external file-based agent spec references (`specPath`) with inline `instructions` on `AgentConfig`. Added full agent CRUD (create, read, update, delete) across backend API and web UI. Removed `workspacePath` from task types (now computed at runtime). Removed the `Agent.Spec` module entirely.

## Files Modified

### Shared Types
- `packages/shared/Types.gren` - Removed `workspacePath` from `DescriptionOnlyTask` and `PlannedTask` type aliases. Removed `taskWorkspacePath` accessor. Added `AgentConfig` type alias with `instructions` field. Added `encodeAgentConfig` and `agentConfigDecoder` (backward-compatible: old JSON with `specPath` decodes to empty instructions). Updated encoders/decoders to remove `workspacePath`. Refactored decoders from `map8` to `map5` + `andThen` chains. Updated `planTask` to not copy `workspacePath`.

### Agent Registry
- `packages/chorus/src/Agent/Registry.gren` - Rewrote to import `AgentConfig` from shared `Types` instead of defining locally. Seed defaults now use `instructions` field. Added `updateAgent` and `deleteAgent` functions. Removed local encoder/decoder.

### Agent Spec (Removed)
- `packages/chorus/src/Agent/Spec.gren` - Deleted entirely (no longer parsing agent specs from markdown files).

### Provider
- `packages/chorus/src/Provider.gren` - Added `AgentSpec` type alias directly (was previously imported from `Agent.Spec`). Added to module exports.
- `packages/chorus/src/Provider/ClaudeCode.gren` - Changed import from `Agent.Spec` to `Provider` for `AgentSpec`.

### Executor
- `packages/chorus/src/Agent/Executor.gren` - Removed `Agent.Spec` import, now imports `AgentSpec` from `Provider`. Removed `SpecParseError` from `ExecutorError`. Simplified `init` to take `AgentSpec` directly instead of reading from file.

### Web Router
- `packages/chorus/src/Web/Router.gren` - Added `CreateAgent`, `UpdateAgent`, `DeleteAgent` route constructors with parsing rules and `routeToString` cases.

### Web API
- `packages/chorus/src/Web/Api.gren` - Added `requestCreateAgent`, `requestUpdateAgent`, `requestDeleteAgent` handler functions. Updated imports.

### Main (Backend)
- `packages/chorus/src/Main.gren` - Removed `GotAgentSpecLoaded` message. Updated `GotHandoffRecorded` to use inline instructions directly. Computes `workspaceRoot` at runtime. Added agent CRUD route handling and `parseAgentBody` function.

### Task Registry
- `packages/chorus/src/Task/Registry.gren` - Removed `workspacePath` from task creation.

### UI API Client
- `packages/chorus-ui/src/Api.gren` - Added `getAgents`, `getAgent`, `createAgent`, `updateAgent`, `deleteAgent` functions.

### UI Agents View (New)
- `packages/chorus-ui/src/View/Agents.gren` - New module with agent list, create, edit, and delete views. Includes `AgentForm` type and card-based layout showing agent name, permissions, tools, and truncated instructions preview.

### UI Main
- `packages/chorus-ui/src/Main.gren` - Added `AgentsPage` to `Page` type. Added "Agents" nav tab alongside "Board". Added agent CRUD messages and update handlers. Added agents/agentForm to Model. Updated URL routing for `/agents` path. Updated `Poll` to refresh agents on AgentsPage.

### UI Task Detail
- `packages/chorus-ui/src/View/TaskDetail.gren` - Removed "Workspace" display from task info section.

### Tests
- `packages/chorus/tests/unit/RegistryTests.gren` - Removed all `workspacePath` references from test task records.
- `packages/chorus/tests/unit/SpecTests.gren` - Deleted (module no longer exists).
- `packages/chorus/tests/unit/TestRunner.gren` - Removed `SpecTests` import and reference.

## Build Status
**Status:** PASS

All 8 UI modules, 13 backend modules, and tool packages compiled successfully.

## Test Status
**Status:** PASS

- Unit tests: 27 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes
- The `agentConfigDecoder` uses `Decode.oneOf` for backward compatibility: it first tries to decode an `instructions` field, falling back to an empty string. This means existing agent JSON files with `specPath` (but no `instructions`) will decode successfully with empty instructions, allowing graceful migration.
- Gren uses `String.unitLength` instead of `String.length` (discovered during build verification).
- The SPA routing for `/agents` is already handled by the existing static file server, which falls back to `index.html` for paths that don't contain a `.` extension.
- The UI agent form modal follows the same pattern as the existing task create modal (overlay with `stopPropagationOn` for click handling).
- `workspaceRoot` is now computed at runtime in Main.gren as `config.workspacesRoot ++ "/" ++ taskId` rather than being stored on each task record.

## Iteration
1
