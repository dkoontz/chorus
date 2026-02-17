# Developer Report

## Task
Implement Phase 4: Wire everything into Main.gren. Replace the old `buildAgentSpawn`/`dispatchPlanner` direct CLI spawning with the unified Provider -> Executor path. Route CLI tool callbacks through the Provider.

## Files Modified

### `packages/chorus/src/Main.gren`
- **ExecutorState restructured:** Removed `status`, `completionReport`, `plannerOutput` fields. Added `executorModel : Executor.UnifiedModel`, `providerState : Provider.ProviderState`, `provider : Provider.UnifiedProvider Msg`.
- **New Msg variants:** `GotProviderEvent`, `GotExecutorMsg`, `GotProviderResolved` for the unified event-driven flow.
- **New functions:**
  - `makeUnifiedProvider` - Factory creating `UnifiedProvider` from model, agent config, and provider config.
  - `spawnAgent` - Creates executor state and starts agent via unified provider (takes resolved ProviderConfig).
  - `resolveAndSpawnAgent` - Creates placeholder executor, resolves provider config async, emits `GotProviderResolved`.
  - `makeToolExecutionContext` - Builds `ToolExecutionContext` for the Executor's tool processing.
  - `handleProviderEvent` - Routes `ProviderEvent` (ToolCallReceived, AgentCompleted, AgentFailed) to executor messages.
  - `handleExecutorMsg` - Runs `Executor.unifiedUpdate`, handles `UpdateEffect` (NoEffect, DeliverToolResults, DeferredActionRequired).
  - `handleExecutorStateTransition` - Checks for terminal executor states (ExecutorComplete, ExecutorFailed) and delegates to completion handlers.
  - `handleDeferredAction` - Handles handoff and planner output deferred actions from the Executor.
  - `extractCompletionReport` / `extractPlannerOutput` - Read from `UnifiedModel` running state.
- **GotToolAgentLookup updated:** When an active executor exists, routes through Provider -> Executor path (store HTTP response via `provider.handleHttpToolCall`, forward `ToolCallReceived` to Executor). Falls back to direct `requestExecuteTool` when no executor exists.
- **GotHandoffRecorded / GotDeferredHandoffStarted updated:** Use `resolveAndSpawnAgent` instead of `buildAgentSpawn`.
- **dispatchPlanner rewritten:** Uses async task chain (lookup agent, set Planning status, record events, resolve system agent provider) then emits `GotProviderResolved` with `isSystemAgent = True` to trigger unified spawn.
- **GotToolResult updated:** `DeferredPlannerOutput` branch now uses `extractPlannerOutput executor.executorModel` instead of old `executor.plannerOutput` field. Completion-report tracking removed (now handled by Executor state machine).
- **Deleted:** `buildAgentSpawn`, `buildShellCommandForProvider` (replaced by unified path).

### `packages/chorus/src/Agent/Executor.gren`
- Fixed `import Task` to `import Task exposing (Task)` to resolve naming error with `Task/` directory in chorus package.

### `packages/chorus/src/Provider/ClaudeCode.gren` (from earlier iterations in this session)
- Added `unifiedProvider` function implementing `UnifiedProvider` interface.
- Added `startAgentUnified`, `deliverToolResultsUnified`, `handleHttpToolCallUnified`.

### `packages/chorus/src/Provider/OpenCode.gren` (from earlier iterations in this session)
- Added `unifiedProvider` function implementing `UnifiedProvider` interface.
- Added `startAgentUnified`, `deliverToolResultsUnified`, `handleHttpToolCallUnified`.

### `packages/chorus/src/Provider.gren` (from earlier iterations in this session)
- Added `taskId : Maybe String` and `allowedTools : Maybe String` to `StartConfig`.

## Build Status
**Status:** PASS

All 3 build targets (UI, tools, chorus) compiled successfully with 0 errors.

## Test Status
**Status:** PASS

77 passed, 0 failed.

## Implementation Notes

### Two-phase provider resolution
The core architectural challenge was bridging async provider resolution with synchronous provider creation. `ProviderRegistry.getProvider` reads from the filesystem (returns `Task`), but `UnifiedProvider.startAgent` returns `{ state, cmd }` which cannot be executed inside a Task chain.

Solution: `resolveAndSpawnAgent` creates a placeholder executor state with a no-op provider immediately, then resolves the provider config as an async Task. On success, it emits `GotProviderResolved`, which calls `spawnAgent` with the resolved config and replaces the placeholder executor state.

### System agent (planner) provider resolution
Internal agents like "task-validator" don't have their own provider reference -- they use `workspaceConfig.systemAgentProvider`. Since `resolveProviderConfig` fails for internal agents, `dispatchPlanner` does its own async resolution chain and emits `GotProviderResolved` directly, bypassing `resolveAndSpawnAgent`.

### CLI tool call flow (unified)
1. HTTP callback arrives at `GotToolAgentLookup`
2. `provider.handleHttpToolCall` stores the HTTP response handle by tool call ID
3. `ToolCallReceived` forwarded to Executor via `GotExecutorMsg`
4. Executor calls `executeToolCall` (via ToolExecution)
5. On `ToolCallCompleted`, Executor returns `DeliverToolResults` effect
6. `handleExecutorMsg` calls `provider.deliverToolResults`, which sends stored HTTP responses

### Legacy GotAgentComplete retained
The `GotAgentComplete` Msg variant and handler are retained but are no longer emitted by any code path. They serve as a safety net during the transition period.

## Iteration
5
