# Unify API Types into Shared Module

## Summary

Extract duplicated type definitions, encoders, and decoders from the backend (`Task.Registry`, `Task.Queue`) and frontend (`Api`) into a single shared `Types` module that both applications reference. This eliminates the class of bugs where the API contract diverges between frontend and backend.

## Requirements

- Create `src/shared/Types.gren` containing all types that cross the API boundary, their encoders, decoders, accessor functions, and helpers
- Both `src/chorus/` and `src/chorus-ui/` reference the shared module via the `source-directories` field in their `gren.json`
- Remove the now-duplicated type definitions, encoders, decoders, and accessors from `Task.Registry`, `Task.Queue`, and `Api`
- Backend-only types (`Registry`, `Error`, `TaskSummary`, `RegistryIndex`) remain in their current modules
- Frontend-only code (HTTP client functions, `dataDecoder` response wrapper) remains in `Api.gren`
- All test `gren.json` files updated to include the shared source directory
- The shared module depends only on `gren-lang/core` (no platform-specific imports) so it compiles for both node and browser

## Acceptance Criteria

- [x] `src/shared/Types.gren` exists as module `Types`, exposing shared types, encoders, decoders, accessors, and helpers
- [x] Types in `Types.gren`: `Task(..)`, `DescriptionOnlyTask`, `PlannedTask`, `PlanningFields`, `TaskStatus(..)`, `SourceInfo`, `Attachment`, `Event`, `History`, `QueuedMessage`, `Queue`
- [x] Encoders in `Types.gren`: `encodeTask`, `encodeStatus`, `encodeSourceInfo`, `encodeAttachment`, `encodeEvent`, `encodeHistory`, `encodeQueue`, `encodeMessage`, `encodeMaybe`
- [x] Decoders in `Types.gren`: `taskDecoder`, `statusDecoder`, `sourceInfoDecoder`, `attachmentDecoder`, `eventDecoder`, `historyDecoder`, `queueDecoder`, `messageDecoder` (with `legacyTaskDecoder` used internally)
- [x] Accessors in `Types.gren`: `taskId`, `taskDescription`, `taskStatus`, `taskCreatedAt`, `taskUpdatedAt`, `taskSessionId`, `taskSource`, `taskAgentWorkspace`, `taskAttachments`, `isPlanned`
- [x] Mutators in `Types.gren`: `planTask`, `setTaskStatus`, `setAttachments`
- [x] Helpers in `Types.gren`: `statusToString`, `statusFromString`, `statusEquals`
- [x] `src/chorus/gren.json` has `"source-directories": ["src", "../shared"]`
- [x] `src/chorus-ui/gren.json` has `"source-directories": ["src", "../shared"]`
- [x] `src/chorus/tests/unit/gren.json` includes `"../../../shared"` in source-directories
- [x] `src/chorus/tests/integration/gren.json` includes `"../../../shared"` in source-directories
- [x] `Task.Registry` no longer defines shared types/encoders/decoders — imports from `Types`
- [x] `Task.Queue` no longer defines `QueuedMessage`, `Queue`, or their codecs — imports from `Types`
- [x] `Api.gren` no longer defines shared types/decoders/accessors — imports from `Types`
- [x] All frontend view modules import types from `Types` instead of `Api`
- [x] `npm run build:app` succeeds (both chorus and chorus-ui compile)
- [x] `npm run test` passes (all unit and integration tests)

## Out of Scope

- Renaming the frontend `Api` module (it stays as `Api`, just slimmer)
- Converting `SourceInfo.sourceType` to a union type
- Newtype wrappers for IDs (separate task: `newtype-structured-data`)
- Sharing the `Types` module with `src/tools/`

## Technical Context

### New Files

- `src/shared/Types.gren` — The shared module. Use the backend's `Task.Registry` as the canonical source for encoder/decoder implementations since it has the most complete set. The frontend's versions are nearly identical.

### Files to Modify

- `src/chorus/gren.json` — Add `"../shared"` to source-directories
- `src/chorus-ui/gren.json` — Add `"../shared"` to source-directories
- `src/chorus/tests/unit/gren.json` — Add `"../../../shared"` to source-directories
- `src/chorus/tests/integration/gren.json` — Add `"../../../shared"` to source-directories
- `src/chorus/src/Task/Registry.gren` — Remove shared types, encoders, decoders, accessors, mutators, helpers. Add `import Types`. Keep `Registry` opaque type, `Error(..)`, `TaskSummary`, `RegistryIndex` + their codecs, CRUD operations, file helpers, `contentTypeFromExtension`, `encodeEmptyQueue`
- `src/chorus/src/Task/Queue.gren` — Remove `QueuedMessage` type, `Queue` alias, `encodeQueue`, `encodeMessage`, `queueDecoder`, `messageDecoder`. Add `import Types`. Keep `Error(..)`, file operations, queue operations (enqueue, dequeue, peek, isEmpty, length)
- `src/chorus/src/Web/Api.gren` — Add `import Types`. Change `Registry.encodeTask` to `Types.encodeTask`, `Registry.TaskStatus` to `Types.TaskStatus`, etc. Update `parseStatus` helper to use `Types` constructors
- `src/chorus/src/Main.gren` — Add `import Types`. Update `parseStatusBody` and `parseCreateTaskBody` to use `Types` constructors and `Types.sourceInfoDecoder`
- `src/chorus-ui/src/Api.gren` — Remove all type definitions, decoders, `encodeSourceInfo`, accessors, helpers. Add `import Types`. Keep HTTP client functions and `dataDecoder`. Update `updateTaskStatus` to use `Types.encodeStatus`. Update module exposing list
- `src/chorus-ui/src/Main.gren` — Add `import Types` alongside `import Api`
- `src/chorus-ui/src/View/Dashboard.gren` — Replace `import Api` type usage with `import Types`
- `src/chorus-ui/src/View/TaskList.gren` — Same
- `src/chorus-ui/src/View/TaskDetail.gren` — Same
- `src/chorus-ui/src/View/History.gren` — Same
- `src/chorus/tests/unit/RegistryTests.gren` — Import types from `Types` instead of `Task.Registry`
- `src/chorus/tests/unit/QueueTests.gren` — Import `QueuedMessage` from `Types` instead of `Task.Queue`
- `src/chorus/tests/integration/IntegrationRunner.gren` — Import types from `Types`

### Related Files (reference only)

- `src/chorus/tests/unit/gren.json` — Already demonstrates multiple source-directories pattern: `[".", "../../src"]`
- `agents/planner.md` — Task file template format

### Patterns to Follow

- Multiple source-directories is already used by test configs (e.g., `src/chorus/tests/unit/gren.json` uses `[".", "../../src"]`)
- The shared module only imports from `gren-lang/core` (Json.Encode, Json.Decode, Time, Dict, Array, String) — no platform-specific packages
- Gren cannot re-export imported types from a module's exposing clause, so consumers that previously used `Registry.Task` or `Api.Task` must change to `Types.Task` or use `import Types exposing (Task(..))`

## Testing Requirements

- `npm run build:app` — both chorus and chorus-ui compile without errors
- `npm run test:unit` — all unit tests pass
- `npm run test:integration` — all integration tests pass
- Manual verification: `npm run build:all && npm run docker:compose`, confirm UI loads and displays tasks

## Notes

- The backend's `TaskSummary` and `RegistryIndex` types stay in `Task.Registry` because they're internal storage types not part of the API contract
- The backend's `encodeEmptyQueue` stays in `Task.Registry` as it's a convenience for initializing new task directories
- The `parseStatusBody` in `Main.gren` has a third duplicate of the status decoder (with backward-compatible flat format support). After this refactor, it should use `Types.statusDecoder` for the nested format and keep only the flat-string fallback locally
- `Web.Api.parseStatus` helper (string→TaskStatus) is similar to `statusFromString` — after refactoring, it can delegate to `Types.statusFromString`
