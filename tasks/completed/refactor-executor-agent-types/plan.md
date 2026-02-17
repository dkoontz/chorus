# Refactor Executor to Encode Agent Types in Model

## Summary

Replace the executor's flat `Maybe CompletionReport` / `Maybe PlannerOutput` fields with agent-type-specific models, so each agent kind carries only its own completion data as non-Maybe fields. Introduce a distinct `ExitedWithoutReport` completion state that is neither success nor error.

## Requirements

- The executor's `Model` must carry per-agent-kind accumulated metadata instead of the current union of `Maybe CompletionReport` and `Maybe PlannerOutput` across all states.
- Internal agent types must be explicitly enumerated (currently just `TaskValidator`). Each internal type defines its own completion data shape.
- User-defined agents carry a `CompletionReport` (non-Maybe) when they complete successfully with a report.
- An agent exiting without submitting a report is a unique state (`ExitedWithoutReport`), distinct from success and error. If retries are exhausted and the agent still has not submitted a report, the result becomes an error.
- The `AgentKind` type in `Main.gren` must be replaced by a proper agent type that flows through executor initialization, so dispatch in `GotAgentComplete` uses pattern matching on the agent type rather than a separate `agentKind` field.
- The `DeferredAction` type `PlannerOutputReady` is only valid for the task-validator internal agent; this should be enforced by types where practical.
- `Agent.Manager` completion functions must accept typed agent data rather than `Maybe` fields.

## Acceptance Criteria

- [ ] `Executor.Model` states (`Running`, `Complete`, `Failed`) no longer carry both `completionReport` and `plannerOutput` as `Maybe` fields. Each state carries only the metadata relevant to the agent type running.
- [ ] A new `ExitedWithoutReport` variant exists in the user-agent completion result, distinct from `CompletedWithReport` and `AgentExitError`.
- [ ] The `AgentKind` type is replaced by a union that enumerates internal agent types: `type AgentType = Internal InternalAgentType | UserDefined`.
- [ ] `InternalAgentType` enumerates specific internal agents (currently just `TaskValidator`).
- [ ] `extractCompletionReport` and `extractPlannerOutput` in `Main.gren` are replaced by typed accessors that only exist for the relevant agent type, eliminating the need for `Maybe` wrapping on data that is guaranteed present.
- [ ] `Agent.Manager.processAgentCompletion` receives a `CompletionReport` (not `Maybe CompletionReport`) when a report was submitted, and the without-report case is handled before calling it.
- [ ] `Agent.Manager.processPlannerCompletion` receives a `PlannerOutput` (not `Maybe PlannerOutput`) when output was submitted, and the missing-output case is handled before calling it.
- [ ] All existing dispatch logic in `GotAgentComplete`, `handleExecutorStateTransition`, and `handleDeferredAction` works correctly after the refactor.
- [ ] The project compiles with `npm run build:all`.
- [ ] Tests pass with `npm run test`.

## Out of Scope

- Adding new internal agent types beyond `TaskValidator`.
- Changing the `Types.AgentConfig` union in the shared module (it already has `InternalAgent` / `UserDefinedAgent` variants and that is fine).
- Modifying provider logic or the `Provider` module.
- Changing how tools are dispatched or executed (the `ToolExecution` module is untouched).
- Adding retry logic for user agents that exit without a report (the retry mechanism already exists for the planner; the user-agent path just needs the new `ExitedWithoutReport` state).
- Modifying the UI or any decoder/encoder in the shared `Types` module.

## Technical Context

### Type Changes

#### 1. New `AgentType` (replaces `AgentKind` in Main.gren)

```gren
type AgentType
    = Internal InternalAgentType
    | UserDefined

type InternalAgentType
    = TaskValidator
```

This replaces the current `AgentKind = SystemAgent | UserAgent`. The `AgentType` is stored on `SpawningExecutor` and `ActiveExecutor` in place of `agentKind`.

#### 2. New executor `AccumulatedData` (replaces flat Maybe fields)

```gren
-- In Executor.gren, replace the current flat record fields with:
type AccumulatedData
    = UserAgentData { completionReport : Maybe CompletionReport }
    | TaskValidatorData { plannerOutput : Maybe PlannerOutput }
```

The `Running`, `Complete`, and `Failed` states carry `AccumulatedData` instead of separate `completionReport : Maybe CompletionReport` and `plannerOutput : Maybe PlannerOutput` fields.

#### 3. Updated `Executor.Model`

```gren
type Model
    = Idle
    | Running
        { pendingToolCalls : Dict String PendingTool
        , completedResults : Array ToolResult
        , accumulatedData : AccumulatedData
        }
    | AwaitingDeferredAction DeferredAction
    | Complete
        { output : String
        , accumulatedData : AccumulatedData
        }
    | Failed
        { error : String
        , accumulatedData : AccumulatedData
        }
```

#### 4. New `Executor.init` takes an `AccumulatedData` parameter

```gren
init : AccumulatedData -> Model
```

This replaces the current `init = Idle` with a function that receives the initial data shape, so when the executor transitions from `Idle` to `Running` on the first `ToolCallReceived`, it knows which `AccumulatedData` variant to use.

Alternatively, `init` can remain as `Idle` and the `AccumulatedData` is passed via a new field on `Config` or via a new `Start` message. The developer should choose the approach that results in the cleanest code. The key constraint is: the executor must know the agent type before the first tool call arrives, so it can construct the correct `AccumulatedData` variant.

#### 5. Updated `Agent.Manager` functions

`processAgentCompletion` splits into two paths:
- When a `CompletionReport` is present, produce `CompletedWithReport`.
- When no report is present, produce `ExitedWithoutReport` (not an error).
- When the exit result is `Err`, produce `AgentExitError`.

```gren
type AgentCompletionResult
    = CompletedWithReport CompletionReport
    | ExitedWithoutReport String
    | AgentExitError String
```

`ExitedWithoutReport` replaces `CompletedWithoutReport`. The name change reflects that this is a unique state, not a successful completion.

`processPlannerCompletion` similarly takes non-Maybe input when output exists:
- Receives `Maybe PlannerOutput` but the `PlannerOutputMissing` case is kept since it triggers retry logic.

#### 6. Updated `extractCompletionReport` / `extractPlannerOutput`

These functions in `Main.gren` change to typed accessors:

```gren
extractUserAgentData : Executor.Model -> Maybe CompletionReport
extractUserAgentData executorModel =
    when executorModel is
        Executor.Running { accumulatedData } ->
            when accumulatedData is
                Executor.UserAgentData { completionReport } -> completionReport
                _ -> Nothing
        Executor.Complete { accumulatedData } ->
            when accumulatedData is
                Executor.UserAgentData { completionReport } -> completionReport
                _ -> Nothing
        Executor.Failed { accumulatedData } ->
            when accumulatedData is
                Executor.UserAgentData { completionReport } -> completionReport
                _ -> Nothing
        _ -> Nothing

extractPlannerData : Executor.Model -> Maybe PlannerOutput
extractPlannerData executorModel =
    -- Similar pattern for TaskValidatorData
```

These are interim; once the dispatch in `GotAgentComplete` is fully type-driven, the `_ -> Nothing` branches become unreachable dead code and can be simplified.

### Files to Modify

- `packages/chorus/src/Agent/Executor.gren` - Add `AccumulatedData` type, update `Model` states, update `init`, update `handleToolCallCompleted` and `collectResultAndCheckBatch` to use `AccumulatedData`, expose `AccumulatedData(..)`.
- `packages/chorus/src/Agent/Manager.gren` - Rename `CompletedWithoutReport` to `ExitedWithoutReport`, adjust `processAgentCompletion` input types.
- `packages/chorus/src/Main.gren` - Replace `AgentKind` with `AgentType`/`InternalAgentType`, update `SpawningExecutor`/`ActiveExecutor` to use `agentType` field, update `spawnAgent`/`resolveAndSpawnAgent` to compute `AgentType` and pass `AccumulatedData` to executor init, update `extractCompletionReport`/`extractPlannerOutput`, update all `GotAgentComplete` handlers to dispatch on `agentType`, update `handleDeferredAction` for `PlannerOutputReady`, update `handlePlannerComplete`/`handleUserAgentComplete` to use new types.

### Related Files (reference only)

- `packages/shared/Types.gren` - Defines `CompletionReport`, `PlannerOutput`, `AgentConfig`. Not modified; the executor uses these types as-is.
- `packages/chorus/src/Web/ToolExecution.gren` - Defines `ToolCallResult` and `completionReportInputDecoder`. Not modified.
- `packages/chorus/src/Web/Api.gren` - Defines `ApiResult` variants (`DeferredHandoff`, `DeferredPlannerOutput`). Not modified.

### Patterns to Follow

- **Make invalid states unrepresentable** (CODING_STANDARDS.md): The core motivation. The current `Maybe CompletionReport` + `Maybe PlannerOutput` on every executor state allows impossible combinations (a user agent with `plannerOutput = Just ...`). The `AccumulatedData` union eliminates this.
- **Gren union types for state machines**: Follow the existing `ExecutorState` pattern (`Spawning | AgentActive | ActiveHandoff`) where each variant carries only its relevant data.
- **No backwards-compatibility defaults**: Per CLAUDE.md, decoders/types must match exactly. No `Maybe.withDefault` to paper over the transition.
- **`when...is` for pattern matching**: All dispatch uses Gren's `when...is` syntax.

### Implementation Order

The changes should be made in this order to keep the code compiling at each step:

1. **Add `AccumulatedData` to `Executor.gren`** - Define the new type alongside the existing fields. Expose it from the module. Do not change `Model` yet.

2. **Update `Executor.Model` to use `AccumulatedData`** - Replace `completionReport`/`plannerOutput` fields with `accumulatedData` in `Running`, `Complete`, and `Failed`. Update `init` to accept or know about the data variant. Update `handleToolCallCompleted` and `collectResultAndCheckBatch`. This will break `Main.gren` temporarily.

3. **Update `Agent.Manager`** - Rename `CompletedWithoutReport` to `ExitedWithoutReport`. Adjust function signatures if needed. This will break the `Main.gren` references temporarily.

4. **Update `Main.gren`** - This is the largest change. Do it in sub-steps:
   a. Replace `AgentKind` with `AgentType` / `InternalAgentType`.
   b. Update `SpawningExecutor` and `ActiveExecutor` to use `agentType : AgentType`.
   c. Update `spawnAgent` / `resolveAndSpawnAgent` to compute the `AgentType` and pass `AccumulatedData` to executor init.
   d. Update `extractCompletionReport` / `extractPlannerOutput` to work with `AccumulatedData`.
   e. Update `GotAgentComplete` dispatch to match on `agentType` (using `Internal TaskValidator` instead of `SystemAgent`).
   f. Update `handleUserAgentComplete` to use `ExitedWithoutReport` instead of `CompletedWithoutReport`.
   g. Update `handleDeferredAction` for `PlannerOutputReady` to construct `TaskValidatorData`.
   h. Update `handleExecutorStateTransition` dispatch.
   i. Update the `completion-report` and `planner-output` once-only enforcement checks.

5. **Compile and fix** - Run `npm run build:all` and fix any remaining type errors.

6. **Run tests** - Run `npm run test` and verify everything passes.

## Testing Requirements

- `npm run build:all` compiles without errors.
- `npm run test` passes (existing tests in `packages/chorus/tests/` continue to work).
- Manual verification: The developer should trace through the `GotAgentComplete` handler for both agent types and confirm the dispatch is correct by reading the code paths.
- No existing tests directly test `Executor` or `Agent.Manager`, so the primary verification is successful compilation (Gren's type system enforces correctness of pattern matches) and existing integration tests.

## Notes

- The `AccumulatedData` type is internal to the executor. `Main.gren` needs access to it (for constructing initial data and for `handleDeferredAction` which mutates the executor model), so `Executor.gren` must expose `AccumulatedData(..)` with its constructors.
- The `ToolCallReceived` handler in `Executor.update` currently creates fresh running state with `completionReport = Nothing, plannerOutput = Nothing` when the model is not already `Running`. After this refactor, it needs the `AccumulatedData` variant to construct the fresh state. This is why `init` (or `Config`) must carry the agent type information.
- The `CompletedWithoutReport` -> `ExitedWithoutReport` rename is intentional: the user specified this is a unique state, not a success. The name "completed" implied success. "Exited" is neutral and accurate. The existing handling in `Main.gren` for this case (calling `requestComplete` with the output text) remains the same behavior-wise; only the name changes.
- The planner retry logic for `PlannerOutputMissing` is unchanged. The `Maybe PlannerOutput` -> non-Maybe split for `processPlannerCompletion` is optional; the developer may keep `Maybe PlannerOutput` as input if it results in cleaner code, since the missing case has its own variant (`PlannerOutputMissing`) that triggers retries. The key requirement is that the executor model itself does not carry both Maybe fields.
