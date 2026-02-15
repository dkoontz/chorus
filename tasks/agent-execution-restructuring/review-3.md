# Code Review Report

## Summary

Phase 3 adds the unified executor state machine to `Agent/Executor.gren` alongside the existing legacy executor. The implementation is well-structured and follows the plan closely. The types are well-designed (state machine with distinct variants, `UpdateEffect` for provider-agnostic signaling). There is one correctness concern (unused binding that indicates dead code), and several simplification opportunities.

## Issues Found

### BLOCKING Issues

#### Issue 1: Unused `updatedState` binding in `DeferredPlannerOutput` branch
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 754-758
- **Category:** Correctness
- **Description:** The `updatedState` variable is defined (setting `pendingToolCalls = remainingPending` and `plannerOutput = Just plannerOutput`) but is never referenced in the return value. The model transitions directly to `AwaitingDeferredAction (PlannerOutputReady plannerOutput)` without incorporating `updatedState`. This means the pending tool call is not actually removed from state before the transition, and the planner output is not stored on the `Running` record. Since the model transitions away from `Running` entirely, the `Running` state with its pending tools is discarded. If the executor later needs to return to `Running` (e.g., after the deferred action is resolved in Phase 4), the pending tools and stored planner output will be lost. Either the `updatedState` should be used or removed if it is genuinely unnecessary.
- **Suggestion:** If the intent is to discard the running state (same as `DeferredHandoff` does), remove the `updatedState` binding entirely to avoid confusion. If the running state might be needed after the deferred action resolves, store it on the `AwaitingDeferredAction` variant or use `updatedState` in a `Running` fallback. Either way, the current code has a dead binding that implies an incomplete implementation.

### Suggestions

#### Suggestion 1: `DeferredHandoff` does not remove the tool from pending
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 735-751
- **Category:** Correctness
- **Description:** The `remainingPending` variable (with the handoff tool removed from the dict) is computed at the top of `handleToolCallCompleted` but is not used in the `DeferredHandoff` branch. The model transitions directly to `AwaitingDeferredAction`, discarding all pending tool state. This is likely intentional (a handoff abandons all other pending work), but the inconsistency with the `DeferredPlannerOutput` branch (which does reference `remainingPending` in `updatedState`, even though that binding is unused) suggests the design intent is not fully settled.
- **Suggestion:** Add a comment in the `DeferredHandoff` branch explaining that remaining pending tools are intentionally abandoned during a handoff. This documents the design choice for Phase 4 integration.

#### Suggestion 2: Consolidate identical `Idle` and `_` branches in `ToolCallReceived`
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 648-665
- **Category:** Simplification
- **Description:** The `Idle` branch (lines 648-654) and the catch-all `_` branch (lines 656-665) produce identical values. Both create a fresh `Running` state with a single pending tool and empty/Nothing fields.
- **Suggestion:** Remove the separate `Idle` branch and let it fall through to the `_` catch-all, or combine them as a single `_ ->` branch with a comment noting which states are covered. This eliminates 7 lines of duplication.

#### Suggestion 3: Consolidate identical `AgentCompleted` branches
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 690-704
- **Category:** Simplification
- **Description:** The `Running state ->` and `_ ->` branches both produce the same result: `{ model = ExecutorComplete { output = output }, cmd = Cmd.none, effect = NoEffect }`. The `when` expression on `model` adds no value since both branches behave identically.
- **Suggestion:** Remove the `when model is` expression and directly return the `ExecutorComplete` result, similar to how `AgentFailed` is already handled (lines 706-711).

#### Suggestion 4: Duplicate `Handoff` record construction
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 735-751
- **Category:** Duplication
- **Description:** The `Handoff { agentName = params.agentName, prompt = params.prompt }` record is constructed identically twice -- once for the `model` field and once for the `effect` field.
- **Suggestion:** Extract to a `let` binding:
  ```gren
  let
      action =
          Handoff
              { agentName = params.agentName
              , prompt = params.prompt
              }
  in
  { model = AwaitingDeferredAction action
  , cmd = Cmd.none
  , effect = DeferredActionRequired action
  }
  ```

#### Suggestion 5: Duplicate logic in `ApiSuccess` and `ApiError` for batch delivery check
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 799-856
- **Category:** Duplication
- **Description:** Both the `ApiSuccess` and `ApiError` branches contain an identical `if Dict.isEmpty remainingPending then ... else ...` pattern that checks whether all pending tools are done and either emits `DeliverToolResults` or `NoEffect`. The structure (check emptiness, reset or accumulate results, choose effect) is repeated verbatim.
- **Suggestion:** Consider extracting a helper function like `collectResultAndCheckBatch` that takes `remainingPending`, `newResults`, and the updated state fields, and returns the appropriate `{ model, cmd, effect }`. This would reduce the two 20-line blocks to two single-line calls.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The unused `updatedState` binding in the `DeferredPlannerOutput` branch (Issue 1) must be addressed. It is dead code that suggests either an incomplete implementation or a forgotten cleanup. Since Phase 4 will wire this into Main.gren, leaving an ambiguous dead binding risks introducing bugs when someone reads this code and assumes the state update is taking effect. Either remove the binding (if discarding running state is intentional) or use it.

The suggestions are worth considering but are not blocking. The duplicate record construction and branch consolidation opportunities are straightforward improvements that would make the code easier to follow during Phase 4 integration.
