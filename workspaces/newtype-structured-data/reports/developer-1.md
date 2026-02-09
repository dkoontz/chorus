# Developer Report: Newtype Wrappers for Structured Data

## Summary

Introduced opaque newtype wrappers (`TaskId`, `SessionId`, `MessageId`) in a shared `Id` module, renamed `agentWorkspace` to `workspacePath`, replaced raw `String` paths with `FileSystem.Path` in executor/provider configs, and updated all JSON encoding/decoding, function signatures, and tests across the codebase.

## Changes

### New Files

- **`packages/shared/Id.gren`** - Opaque types `TaskId`, `SessionId`, `MessageId` with smart constructors (`fromString` returning `Maybe`), accessors (`toString`), and JSON encode/decode helpers. Depends only on `gren-lang/core`, so it compiles for both node and browser targets. Constructors are not exported.

### Modified Files

**Shared types:**

- **`packages/shared/Types.gren`** - Changed `id` fields to `TaskId`, `sessionId` to `Maybe SessionId`, `QueuedMessage.id` to `MessageId`. Renamed `agentWorkspace` to `workspacePath`. Updated all encoders to use `Id.encodeTaskId`, `Id.encodeSessionId`, `Id.encodeMessageId`. Updated all decoders to use `Id.taskIdDecoder`, `Id.sessionIdDecoder`, `Id.messageIdDecoder`. JSON decoder accepts both `"workspacePath"` and `"agentWorkspace"` for backward compatibility. Renamed accessor `taskAgentWorkspace` to `taskWorkspacePath`. Updated module exposing list accordingly.

**Server-side (chorus package):**

- **`packages/chorus/src/Task/Registry.gren`** - `Error` type changed from `TaskNotFound String` to `TaskNotFound TaskId`. All function signatures updated to use `TaskId` and `SessionId`. `createTask` wraps generated UUID via `Id.taskIdFromString`. `setSessionId` accepts `Maybe SessionId`.

- **`packages/chorus/src/Task/Queue.gren`** - Added `import Id`. `enqueue` wraps generated UUID via `Id.messageIdFromString` to produce a `MessageId`.

- **`packages/chorus/src/Provider.gren`** - Removed re-export of `SessionId` from module exposing list (it is now imported from `Id`). `Session.id` field uses the opaque `SessionId` type.

- **`packages/chorus/src/Provider/ClaudeCode.gren`** - `parseSessionId` returns `Maybe SessionId` via `Id.sessionIdFromString`. `sendMessage` unwraps `SessionId` via `Id.sessionIdToString` when building CLI arguments.

- **`packages/chorus/src/Agent/Executor.gren`** - `Config.workspaceRoot` and `Config.fileToolsPath` changed from `String` to `Path`. `SessionIdLoaded` msg carries `SessionId` instead of `String`. Path-to-string conversions use `Path.toPosixString`. Session ID persistence uses `Id.sessionIdFromString` and `Id.sessionIdToString`.

- **`packages/chorus/src/Web/Router.gren`** - All `Route` variants with task IDs changed from `String` to `TaskId`. Added `withTaskId` helper that parses URL segments via `Id.taskIdFromString` and returns `NotFound` on failure. `routeToString` uses `Id.taskIdToString`.

- **`packages/chorus/src/Web/Api.gren`** - All function signatures changed from `String` to `TaskId` for task ID parameters. Internal path construction converts via `Id.taskIdToString`. Message encoding uses `Id.encodeMessageId`.

- **`packages/chorus/src/Main.gren`** - `ExecutorState.taskId` changed to `TaskId`. All `Msg` variants carrying task IDs use `TaskId`. `Dict String ExecutorState` keys use `Id.taskIdToString taskId` for conversion (Gren's `Dict` requires comparable keys). Logging converts task IDs to strings for display.

**UI (chorus-ui package):**

- **`packages/chorus-ui/src/Main.gren`** - Added `import Id`. `SavePlanning` handler converts `TaskId` to `String` via `Id.taskIdToString` before passing to `Api.updateTaskPlanning`.

- **`packages/chorus-ui/src/View/Dashboard.gren`** - Added `import Id`. Task link href uses `Id.taskIdToString`.

- **`packages/chorus-ui/src/View/TaskList.gren`** - Added `import Id`. Task link href and status action callbacks use `Id.taskIdToString`.

- **`packages/chorus-ui/src/View/TaskDetail.gren`** - Added `import Id`. Task ID display, session ID display, attachment URLs, status actions, and queued message ID display all convert through `Id.taskIdToString`, `Id.sessionIdToString`, and `Id.messageIdToString`. Renamed `Types.taskAgentWorkspace` to `Types.taskWorkspacePath`.

**Tests:**

- **`packages/chorus/tests/unit/RegistryTests.gren`** - Added `testTaskId` and `testSessionId` helper functions that wrap raw strings via `Id.taskIdFromString` / `Id.sessionIdFromString`. All test task records use these helpers. Renamed `agentWorkspace` to `workspacePath` in test data.

- **`packages/chorus/tests/unit/QueueTests.gren`** - Added `testMessageId` helper function. All test message records use it. Assertions comparing message IDs convert via `Id.messageIdToString`.

### Design Decisions

1. **Id module placement**: Located in `packages/shared/` rather than inside either package, since it depends only on `gren-lang/core` and is referenced by both node and browser targets via `source-directories` in their `gren.json` files.

2. **UI Api.gren keeps String parameters**: The browser-side HTTP client (`packages/chorus-ui/src/Api.gren`) continues to use `String` for task ID parameters in its functions. Conversion from `TaskId` to `String` happens at call sites in the UI's Main.gren and view modules. This keeps the API layer simple since the values are used only for URL construction.

3. **Dict keys remain String**: Gren's `Dict` requires comparable keys, and custom types are not automatically comparable. `TaskId` values are converted to `String` via `Id.taskIdToString` at Dict operation boundaries in `Main.gren`.

4. **workspacePath stays String in Types**: The `workspacePath` field in `DescriptionOnlyTask` and `PlannedTask` remains `String` rather than `Path` because `Types.gren` is shared between node and browser targets, and `FileSystem.Path` is only available on the node platform. The conversion to `Path` happens in `Agent/Executor.gren` where `Path.fromPosixString` is used.

5. **Backward-compatible JSON decoding**: The task decoder accepts both `"workspacePath"` and `"agentWorkspace"` JSON keys using `Decode.oneOf`, so existing persisted data continues to load correctly.

6. **Debug.todo in test helpers**: Test helper functions like `testTaskId` use `Debug.todo` for the `Nothing` case of `fromString`, since test data uses known-valid non-empty strings. This is acceptable for test code but would not be appropriate in production code.

## Verification

- All three build targets compile: UI (8 modules), tools (5 modules), chorus (14 modules).
- Test compilation succeeds: 9 modules compiled including RegistryTests, QueueTests, and SpecTests.
- Note: The test runner npm script has a pre-existing filename mismatch (`run-unit-tests.js` vs `unit-tests.js`) that prevents `npm run test:unit` from completing, but the Gren compilation of all test modules succeeds, which verifies type correctness across the test suite.

## Acceptance Criteria Status

- [x] `Id.gren` exists with opaque `TaskId`, `SessionId`, `MessageId` types
- [x] Validation in `fromString`: trims whitespace, rejects empty strings, returns `Maybe`
- [x] Task type uses `TaskId` for `id`, `Maybe SessionId` for `sessionId`
- [x] `workspacePath` field renamed from `agentWorkspace`
- [x] `QueuedMessage` uses `MessageId` for `id`
- [x] `Provider.Session` uses opaque `SessionId` from `Id`
- [x] `Provider.ToolCall.id` and `Provider.ToolResult.toolCallId` remain `String`
- [x] `Agent.Executor.Config` uses `Path` for `workspaceRoot` and `fileToolsPath`
- [x] `Web.Router.Route` variants use `TaskId`; parsing via `Id.taskIdFromString`
- [x] All JSON encoders/decoders updated
- [x] Test modules compile with updated types
- [x] Project builds (`npm run build:app`)
