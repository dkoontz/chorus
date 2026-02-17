# Developer Report

## Task
Replace the executor's flat `Maybe CompletionReport` / `Maybe PlannerOutput` fields with agent-type-specific models (`AccumulatedData`), so each agent kind carries only its own completion data. Introduce `ExitedWithoutReport` completion state and replace `AgentKind` with `AgentType`/`InternalAgentType`.

## Files Modified
- `packages/chorus/src/Agent/Executor.gren` - Added `AccumulatedData` union type (`UserAgentData` / `TaskValidatorData`). Updated `Model` states (`Running`, `Complete`, `Failed`) to carry `accumulatedData` instead of separate `completionReport`/`plannerOutput` fields. Changed `Idle` to carry `AccumulatedData` so the executor knows its agent type before the first tool call. Updated `init` to accept `AccumulatedData`. Updated `handleToolCallCompleted` and `collectResultAndCheckBatch` to use `accumulatedData`. Exposed `AccumulatedData(..)` from the module.
- `packages/chorus/src/Agent/Manager.gren` - Renamed `CompletedWithoutReport` to `ExitedWithoutReport` with updated doc comment explaining this is a distinct state (not a success).
- `packages/chorus/src/Main.gren` - Replaced `AgentKind` (`SystemAgent`/`UserAgent`) with `AgentType` (`Internal InternalAgentType`/`UserDefined`) and `InternalAgentType` (`TaskValidator`). Updated `SpawningExecutor` and `ActiveExecutor` to use `agentType` field. Updated `spawnAgent` and `resolveAndSpawnAgent` to compute `AgentType` and pass appropriate `AccumulatedData` to `Executor.init`. Replaced `extractCompletionReport`/`extractPlannerOutput` with typed accessors `extractUserAgentData`/`extractPlannerData` that work through `AccumulatedData`. Updated all `GotAgentComplete` dispatch to match on `agentType` (`Internal TaskValidator` / `UserDefined`). Updated `handleExecutorStateTransition` dispatch. Updated `handleDeferredAction` for `PlannerOutputReady` to construct `TaskValidatorData`. Updated `dispatchPlanner` to use `Internal TaskValidator`. Updated `handleUserAgentComplete` to use `ExitedWithoutReport`. Updated planner retry logic to use `Executor.init` with `TaskValidatorData`.

## Build Status
**Status:** PASS

```
Success! Compiled 24 modules.
    Main -> build/chorus-tmp
Patched build/chorus.js for Bun compatibility
```

## Test Status
**Status:** PASS

```
Running 87 tests...
87 passed, 0 failed
```

## Implementation Notes
- The `Idle` state now carries `AccumulatedData` rather than being a bare constructor. This ensures the executor always knows which agent type it is serving before the first tool call arrives, eliminating the need for a default fallback in `ToolCallReceived`.
- The `AwaitingDeferredAction` state does not carry `AccumulatedData` since it is a transient state where the executor model is replaced by Main.gren when the deferred action is handled. In the edge case where a tool call arrives during `AwaitingDeferredAction`, a `UserAgentData` fallback is used (same behavior as before).
- The `extractUserAgentData` and `extractPlannerData` functions include a wildcard `_ -> Nothing` branch for `AwaitingDeferredAction`. These branches are effectively unreachable in normal operation but are required for exhaustive pattern matching.
- The `processPlannerCompletion` function in `Agent.Manager` retains `Maybe PlannerOutput` as input since the `PlannerOutputMissing` case triggers retry logic and has its own variant. This aligns with the plan's note that keeping `Maybe` here is acceptable if it results in cleaner code.
- The `accumulatedData` field name was chosen over `data` to be descriptive and searchable, following the coding standard for avoiding abbreviated names.

## Iteration
1
