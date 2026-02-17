# Code Review Report

## Summary

Phase 4 is a large, well-structured integration that successfully replaces the old `buildAgentSpawn`/`buildShellCommandForProvider`/`dispatchPlanner` code paths with the unified Provider -> Executor architecture. The event-driven design is sound. However, there are two blocking correctness issues: the completion report (and planner output) stored on the `Running` state is lost when the executor transitions to `ExecutorComplete`/`ExecutorFailed`, and the planner-output deferred action delivers a tool result with an empty tool call ID, which means the HTTP response to chorus-tools will never be sent.

## Issues Found

### BLOCKING Issues

#### Issue 1: Completion report and planner output lost on agent completion

- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 684-688
- **Category:** Correctness
- **Description:** When `AgentCompleted` arrives, `unifiedUpdate` transitions the model from `Running { completionReport = Just report, plannerOutput = Just output, ... }` to `ExecutorComplete { output = output }`. The `ExecutorComplete` variant does not carry the `completionReport` or `plannerOutput` fields. In `Main.gren`, both `handlePlannerComplete` (line 3190) and `handleUserAgentComplete` (line 3343) call `extractCompletionReport`/`extractPlannerOutput`, which only match the `Running` variant and return `Nothing` for `ExecutorComplete` and `ExecutorFailed`. This means the completion report is silently discarded, causing the task to be treated as having no completion report (agent output missing, task status not properly resolved).
- **Suggestion:** Either (a) carry `completionReport` and `plannerOutput` forward into the `ExecutorComplete` variant (e.g., `ExecutorComplete { output : String, completionReport : Maybe CompletionReport, plannerOutput : Maybe PlannerOutput }`), or (b) capture them during the `AgentCompleted` transition in `unifiedUpdate` by reading them from the current `Running` state before constructing `ExecutorComplete`. Update `extractCompletionReport`/`extractPlannerOutput` accordingly.

#### Issue 2: Planner-output deferred action delivers result with empty tool call ID

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2951-2957
- **Category:** Correctness
- **Description:** In `handleDeferredAction` for `PlannerOutputReady`, the code calls `executor.provider.deliverToolResults` with `toolCallId = ""`. The `deliverToolResultsUnified` implementation does `Dict.get toolResult.toolCallId acc.pending` to find the corresponding HTTP response handle. Since no entry in the pending responses dict has key `""`, the lookup returns `Nothing` and the HTTP response is never sent. The chorus-tools process that submitted the planner-output tool call will hang indefinitely waiting for a response.
- **Suggestion:** Thread the actual tool call ID through the deferred action. Change `DeferredAction` to include the tool call ID: `PlannerOutputReady { toolCallId : String, plannerOutput : PlannerOutput }`. Then set the `toolCallId` on the planner output `ToolResult` from this value. This also applies to the `Handoff` deferred action, which currently uses `Array.first` on `Dict.values` (line 2879-2880) to find the response handle -- a fragile approach that could pick the wrong response if multiple tool calls are pending.

### Suggestions

#### Suggestion 1: Remove dead code in `handleExecutorStateTransition`

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2782-2786
- **Category:** Simplification
- **Description:** The `completionReport` and `plannerOutput` variables are computed in the `ExecutorComplete` branch of `handleExecutorStateTransition` but are never referenced. Both `handlePlannerComplete` and `handleUserAgentComplete` extract these values themselves from the executor passed to them.
- **Suggestion:** Remove the unused `completionReport` and `plannerOutput` bindings and their comment.

#### Suggestion 2: `deliverToolResultsUnified` and `handleHttpToolCallUnified` are duplicated

- **File:** `packages/chorus/src/Provider/ClaudeCode.gren` and `packages/chorus/src/Provider/OpenCode.gren`
- **Line:** ClaudeCode lines 192-274, OpenCode lines 192-281
- **Category:** Duplication
- **Description:** `deliverToolResultsUnified` and `handleHttpToolCallUnified` are character-for-character identical in both provider files. The OpenCode doc comment even says "Same implementation as ClaudeCode since both are CLI providers." This is roughly 80 lines of duplicated logic.
- **Suggestion:** Extract shared CLI provider functions into a common module (e.g., `Provider/Cli.gren` or a shared section in `Provider.gren`). Both providers can then reference the shared implementation.

#### Suggestion 3: `makeUnifiedProvider` branches are identical

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 400-458
- **Category:** Duplication
- **Description:** The `InternalAgent` and `UserDefinedAgent` branches of `makeUnifiedProvider` contain identical code -- the same `baseUrl` computation and the same `when providerConfig.providerType is` dispatch. The `agentConfig` variant makes no difference in the provider construction.
- **Suggestion:** Remove the outer `when agentConfig is` dispatch and construct the provider directly from `providerConfig.providerType`.

#### Suggestion 4: No-op provider record is duplicated three times

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 534-547, 614-621, 3101-3108
- **Category:** Duplication
- **Description:** The no-op `UnifiedProvider` placeholder record (with all fields returning no-ops and `NoProviderState`) is constructed identically in three separate locations: `spawnAgent` (failure case), `resolveAndSpawnAgent`, and `dispatchPlanner`. Each occurrence is 7 lines of identical record construction.
- **Suggestion:** Extract a top-level `noopProvider` constant or a `makeNoopProvider` function and reference it from all three locations.

#### Suggestion 5: `handleExecutorStateTransition` has repetitive branching

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2778-2828
- **Category:** Simplification
- **Description:** The `ExecutorComplete` and `ExecutorFailed` branches each duplicate the `if executor.isSystemAgent then handlePlannerComplete ... else handleUserAgentComplete ...` pattern. Both branches differ only in how `result` is constructed (`Ok output` vs `Err error`).
- **Suggestion:** Extract the result value first, then use a single `if executor.isSystemAgent` check:
  ```
  when executor.executorModel is
      ExecutorComplete { output } -> handleCompletion (Ok output)
      ExecutorFailed { error } -> handleCompletion (Err error)
      _ -> ...
  ```

#### Suggestion 6: Concurrent `Registry.recordEvent` calls in `DeliverToolResults`

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2733-2752
- **Category:** Correctness
- **Description:** Multiple `Registry.recordEvent` calls are mapped over the results array and batched via `Cmd.batch`. Since `recordEvent` does a read-modify-write on `history.json`, concurrent writes risk data loss per the coding standards. In practice, CLI providers typically submit one tool call at a time so the array usually has one element, but the code does not enforce this.
- **Suggestion:** Chain the `recordEvent` tasks sequentially with `Task.andThen` instead of batching them. Alternatively, add a comment documenting the assumption that CLI providers submit tools one at a time.

#### Suggestion 7: `handleHttpToolCallUnified` doc comment is misleading

- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 250-253
- **Category:** Naming
- **Description:** The doc comment says "emits a `ToolCallReceived` event so the Executor can process the tool call" but the function does not emit any event -- it only stores the HTTP response handle and returns `Cmd.none`. The event emission is done by the caller in `Main.gren` (`GotToolAgentLookup` handler). The same misleading comment appears in OpenCode.gren.
- **Suggestion:** Update the doc comment to say "Stores the HTTP response handle in state (keyed by tool call ID). The caller is responsible for emitting the `ToolCallReceived` event to the Executor."

#### Suggestion 8: Stale comment in `resolveAndSpawnAgent`

- **File:** `packages/chorus/src/Main.gren`
- **Line:** 635-648
- **Category:** Simplification
- **Description:** The block comment in `resolveAndSpawnAgent` contains rambling design notes ("But that's complex. Instead, we use a simpler approach...") that reflect the developer's thought process during implementation rather than explaining what the code does. The final approach (emit `GotProviderResolved` message) is straightforward and doesn't need this backstory.
- **Suggestion:** Replace with a concise comment: "Resolve the provider config asynchronously. On success, emit GotProviderResolved to trigger Phase B (start the agent). On failure, emit GotProviderEvent AgentFailed."

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues must be addressed:

1. **Completion report/planner output loss:** The `ExecutorComplete`/`ExecutorFailed` variants must carry forward the `completionReport` and `plannerOutput` from the `Running` state. Without this fix, agents will appear to complete without submitting their completion reports, breaking the task lifecycle.

2. **Empty tool call ID for planner-output:** The planner-output deferred action must deliver the result with the correct tool call ID so the HTTP response reaches chorus-tools. Without this fix, planner agents will hang after submitting their output.

The suggestions (particularly the duplication items) are worth addressing but are not blocking. The overall architecture is well-designed and the code is clearly organized.
