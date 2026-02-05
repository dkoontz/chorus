# Apply Newtype Wrappers for Structured Data (IDs and Paths)

## Summary

Introduce opaque newtype wrappers for `TaskId`, `SessionId`, and `MessageId` in a single `Id` module to prevent mixing different ID types, and replace raw `String` path fields with `FileSystem.Path` (which `gren-lang/node` already provides). Rename `agentWorkspace` to `workspacePath` to reflect its purpose.

## Requirements

- Create an `Id` module (`src/chorus/src/Id.gren`) exposing opaque `TaskId`, `SessionId`, and `MessageId` types, each with `fromString`, `toString`, and JSON encoder/decoder helpers
- Do not export the type constructors -- only the type name and smart constructor/accessor functions
- Replace `agentWorkspace : String` with `workspacePath : Path` using `FileSystem.Path` from `gren-lang/node`
- Replace `workspaceRoot : String` and `fileToolsPath : String` in executor/provider configs with `Path`
- Replace the existing `type alias SessionId = String` in `Provider.gren` with an import of the opaque `SessionId` from `Id`
- Update all JSON encoding/decoding to wrap/unwrap through the `Id` accessor functions
- Update all tests to construct values using the new types
- The UI package (`chorus-ui`) runs in the browser and cannot use `FileSystem.Path`; it should keep string-based path representations but may adopt the ID newtypes if the `Id` module has no node-specific dependencies (otherwise keep strings in the UI)

## Acceptance Criteria

- [ ] `src/chorus/src/Id.gren` exists, exposing `TaskId`, `SessionId`, `MessageId` as opaque types (constructors not exported) with `taskIdFromString`, `taskIdToString`, `sessionIdFromString`, `sessionIdToString`, `messageIdFromString`, `messageIdToString`, plus JSON encoder/decoder for each
- [ ] Validation in `fromString`: trims whitespace, rejects empty strings, returns `Maybe` (matching the `UserId` example in coding standards)
- [ ] `Task.Registry.Task` uses `TaskId` for `id`, `Maybe SessionId` for `sessionId`, and `Path` for the workspace field (renamed from `agentWorkspace` to `workspacePath`)
- [ ] `Task.Registry.TaskSummary` uses `TaskId` for `id`
- [ ] `Task.Queue.QueuedMessage` uses `MessageId` for `id`
- [ ] `Provider.Session` uses the opaque `SessionId` from `Id` (not a type alias)
- [ ] `Provider.ToolCall.id` and `Provider.ToolResult.toolCallId` remain `String` (opaque values from the LLM provider)
- [ ] `Agent.Executor.Config` uses `Path` for `workspaceRoot` and `fileToolsPath`
- [ ] `Web.Router.Route` variants that carry a task ID (`GetTask`, `UpdateTaskStatus`, `GetTaskHistory`, `GetTaskQueue`, `EnqueueMessage`) use `TaskId` instead of `String`; parsing happens in the router via `Id.taskIdFromString`
- [ ] All JSON encoders/decoders in `Task.Registry` and `Task.Queue` are updated
- [ ] All existing unit tests pass (`npm run test:unit`)
- [ ] The project compiles and builds (`npm run build:app`)

## Out of Scope

- Converting `SourceInfo.sourceType` to a union type (separate task)
- Converting `SourceInfo.userId` to a newtype (low priority)
- Adding length or format validation beyond non-empty trimming to ID constructors
- Converting `ToolCall.id` / `ToolResult.toolCallId` to a newtype (opaque values from LLM provider)
- Changes to UI-side path handling (browser has no `FileSystem.Path`)

## Technical Context

### Files to Modify

- `src/chorus/src/Task/Registry.gren` - Update `Task` and `TaskSummary` types to use `TaskId`, `SessionId`, `Path`; rename `agentWorkspace` to `workspacePath`; update all encoders, decoders, and functions that accept or return task IDs
- `src/chorus/src/Task/Queue.gren` - Update `QueuedMessage.id` to `MessageId`; update encoders/decoders
- `src/chorus/src/Provider.gren` - Remove `type alias SessionId = String`; import `SessionId` from `Id`; re-export it; update `Session` type
- `src/chorus/src/Provider/ClaudeCode.gren` - Update session ID construction (wrap parsed string via `Id.sessionIdFromString`)
- `src/chorus/src/Agent/Executor.gren` - Update `Config` fields `workspaceRoot` and `fileToolsPath` to `Path`; update session persistence functions
- `src/chorus/src/Web/Router.gren` - Update route variants to carry `TaskId`; parse task IDs from URL segments using `Id.taskIdFromString`; handle parse failure as `NotFound`
- `src/chorus/src/Web/Api.gren` - Update function signatures to accept `TaskId`; unwrap to `String` only when building file paths
- `src/chorus/src/Main.gren` - Update config to pass `Path` values; task ID parsing now handled by router
- `src/chorus/tests/unit/RegistryTests.gren` - Construct test `Task` values using `Id.taskIdFromString` etc.; handle `Maybe` returns from smart constructors
- `src/chorus/tests/unit/QueueTests.gren` - Construct test `QueuedMessage` values using `Id.messageIdFromString`

### New Files

- `src/chorus/src/Id.gren` - Opaque types `TaskId`, `SessionId`, `MessageId` with smart constructors and accessors

### Related Files (reference only)

- `src/chorus-ui/src/Api.gren` - Browser-side type definitions; cannot use `FileSystem.Path`; may adopt ID newtypes if `Id` module has no node dependencies
- `docs/coding-standards.md` - The "Use Newtypes for Structured Data" section defines the pattern being applied
- `src/chorus/src/Web/Static.gren` - Uses `Path` already, no changes needed
- `src/chorus/src/Logging.gren` - No changes needed

### Patterns to Follow

- Follow the `UserId` opaque type example in `docs/coding-standards.md`: type defined with single constructor, constructor not exported, `fromString` returns `Maybe`, `toString` unwraps
- The project already imports `FileSystem.Path as Path exposing (Path)` in IO modules -- follow the same import style
- JSON encoding for newtypes: use `toString` to unwrap when encoding, use `fromString` in decoder and fail the decode if it returns `Nothing`
- Name the functions with type prefixes to avoid ambiguity since all three types live in one module: `taskIdFromString`, `taskIdToString`, `sessionIdFromString`, etc.

## Testing Requirements

- All existing unit tests in `RegistryTests`, `QueueTests`, and `SpecTests` must pass after updates
- Build must succeed with `npm run build:app`
- JSON round-trip tests for tasks and queued messages must still pass with the new types
- Test data that previously used raw strings like `"test-id-123"` must be constructed via the smart constructors

## Notes

- `FileSystem.Path` from `gren-lang/node` is the right type for filesystem paths. The `FilePath` example in the coding standards shows path traversal validation which is useful for user-facing paths, but for internal configuration paths (like `workspaceRoot`), using `FileSystem.Path` directly is appropriate. No custom path newtype needed.
- The `Id` module should have no platform-specific dependencies (only `gren-lang/core`), which means it could theoretically be shared with the browser UI package. Whether to actually share it or keep the UI using raw strings is left to the implementer's judgment based on the `chorus-ui` build setup.
- The `SourceInfo.sourceType` field (values like `"terminal"`, `"web"`, `"xmpp"`) is a strong candidate for a union type but is out of scope for this task.
- When `taskIdFromString` returns `Nothing` in the router (e.g., empty string in URL), the route should resolve to `NotFound`.
- The `Registry.Error` type has `TaskNotFound String` -- this should become `TaskNotFound TaskId` since it represents a task ID that was looked up but not found.
