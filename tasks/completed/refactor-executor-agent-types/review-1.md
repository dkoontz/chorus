# Code Review Report

## Summary

The implementation correctly replaces the flat `Maybe CompletionReport` / `Maybe PlannerOutput` fields with an `AccumulatedData` union type, renames `CompletedWithoutReport` to `ExitedWithoutReport`, and replaces `AgentKind` with `AgentType`/`InternalAgentType`. The code compiles cleanly and all 87 tests pass. The changes are well-structured and follow the plan faithfully.

## Issues Found

### BLOCKING Issues

No blocking issues found.

### Suggestions

#### Suggestion 1: Extract `accumulatedData` extraction into a helper function in Executor.gren
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 253-306 (AgentCompleted and AgentFailed handlers)
- **Category:** Duplication
- **Description:** The pattern for extracting `accumulatedData` from the current model is repeated identically in three places within `update`: the `ToolCallReceived` handler (lines 193-227 for non-Running states), the `AgentCompleted` handler (lines 254-269), and the `AgentFailed` handler (lines 282-297). All three perform the same five-way match extracting `accumulatedData` from each state variant, with the same `UserAgentData { completionReport = Nothing }` fallback for `AwaitingDeferredAction`.
- **Suggestion:** Extract a helper function like `extractAccumulatedData : Model -> AccumulatedData` that performs the pattern match once. The `ToolCallReceived` handler for the `Running` case would still need its own branch (since it updates rather than creates fresh state), but the four non-Running branches and the two identical blocks in `AgentCompleted`/`AgentFailed` could all call the shared helper.

#### Suggestion 2: Consider naming consistency between `extractUserAgentData` and what it returns
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 3014
- **Category:** Naming
- **Description:** The function `extractUserAgentData` returns `Maybe Types.CompletionReport`, not any kind of "user agent data" record. The name suggests it returns the `UserAgentData` variant or some broader data structure, but it actually unwraps through both the `Model` and the `AccumulatedData` to get at the inner `completionReport` field. At the call sites (lines 3458, 4208), the result is bound to `completionReport`, which is clearer than the function name.
- **Suggestion:** Rename to `extractCompletionReport` to match what it actually returns. The old name was `extractCompletionReport`, and the plan's suggestion of `extractUserAgentData` was for an interim accessor. Since the function already drills through `AccumulatedData` internally, the name should describe the output, not the intermediate data path. Similarly, `extractPlannerData` could be `extractPlannerOutput` since it returns `Maybe Types.PlannerOutput`.

#### Suggestion 3: `AwaitingDeferredAction` fallback assumes user agent type
- **File:** `packages/chorus/src/Agent/Executor.gren`
- **Line:** 219-227, 268-269, 296-297
- **Category:** Correctness
- **Description:** When a tool call, completion, or failure arrives while the executor is in `AwaitingDeferredAction`, the code falls back to `UserAgentData { completionReport = Nothing }`. The developer report acknowledges this as a deliberate choice, noting that `AwaitingDeferredAction` is a transient state. However, if a `TaskValidator` (planner) agent somehow hits this path, any previously accumulated `plannerOutput` would be silently replaced with a `UserAgentData` fallback of the wrong variant.
- **Suggestion:** This is a minor concern given that the path is described as effectively unreachable in normal operation. If you wanted to be defensive, `AwaitingDeferredAction` could carry the `AccumulatedData` alongside the `DeferredAction`, but this would be a larger structural change and may not be worth it given the transient nature of this state. Leaving a comment noting the assumption (that only user agents can reach this path) would be sufficient.

## Overall Assessment

**Decision:** APPROVED

The refactor achieves its core goal: making invalid states unrepresentable by replacing the flat `Maybe` fields with a discriminated `AccumulatedData` union. The `AgentType`/`InternalAgentType` types are well-designed for future extensibility. The `ExitedWithoutReport` rename accurately reflects the semantic distinction. All dispatch logic correctly matches on the new types, and the build and tests confirm correctness. The suggestions above are minor improvements worth considering in future work but are not required for merge.
