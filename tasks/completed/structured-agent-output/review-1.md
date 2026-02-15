# Code Review Report

## Summary

The implementation is well-structured and accomplishes the core objective of replacing JSON-code-fence parsing with structured tool-based output. The new `Agent.Manager` module is clean and properly separated from IO concerns. There are a few issues around code duplication and a missed opportunity to use an existing helper, plus the retry logic was intentionally deferred but the infrastructure remains in place without documentation in the code about its deferred status.

## Issues Found

### BLOCKING Issues

#### Issue 1: Duplicated completion report decoder logic across Main.gren and ToolExecution.gren
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1247-1261
- **Category:** Duplication
- **Description:** Main.gren builds an inline decoder for the completion report in the `GotToolResult` handler (lines 1249-1261) that duplicates the `completionReportInputDecoder` already defined in `Web/ToolExecution.gren` (lines 390-403). The only difference is how `blockedReason` is decoded: Main.gren uses `Decode.maybe (Decode.field "blockedReason" Decode.string)` (field optional), while ToolExecution uses the same pattern. They are actually identical. The dev report claims a difference between `Decode.maybe (Decode.field ...)` and `Decode.field ... (Decode.maybe ...)`, but both Main.gren and ToolExecution.gren actually use the `Decode.maybe (Decode.field ...)` pattern. Meanwhile, `Types.completionReportDecoder` uses `Decode.field "blockedReason" (Decode.maybe Decode.string)` (field required, value nullable). This means there are now three completion report decoders in the codebase with subtly different semantics. The inline decoder in Main.gren should be removed in favor of reusing `completionReportInputDecoder` from ToolExecution (which has the correct semantics for tool input where the field may be omitted entirely). If ToolExecution does not expose it, it should be exported, or the decoder should live in a shared location.
- **Suggestion:** Export `completionReportInputDecoder` from `Web.ToolExecution` and use it in Main.gren, or move the tool-input variant to a shared module. This eliminates the duplication and makes it clear that there is one decoder for tool input (field optional) and one for persistence (field required, value nullable).

#### Issue 2: `dispatchPlanner` manually pattern-matches on Task to set `currentAgent` instead of using `Types.setCurrentAgent`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2513-2519
- **Category:** Duplication / Style
- **Description:** In `dispatchPlanner`, the code manually destructures the `Task` type to set `currentAgent`:
  ```gren
  when task is
      Types.DescriptionOnly t ->
          Types.DescriptionOnly { t | currentAgent = Just "task-validator" }
      Types.Planned t ->
          Types.Planned { t | currentAgent = Just "task-validator" }
  ```
  The `Types` module already provides `setCurrentAgent : Maybe String -> Task -> Task` which does exactly this. The rest of the codebase (e.g., `startAgentOnTask` in `Api.gren`) consistently uses the accessor/mutator functions. Using the raw pattern match here bypasses the abstraction and would need to be updated if the Task type gains new variants.
- **Suggestion:** Replace with `Types.setCurrentAgent (Just "task-validator") task`.

### Suggestions

#### Suggestion 1: Retry infrastructure left in place without clear "deferred" annotation
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 101-103 (ExecutorState fields `retryCount`, `sessionId`)
- **Category:** Simplification
- **Description:** The dev report notes that retry logic was "simplified to immediate failure" and that "the retry infrastructure remains in place for future use." The `retryCount` and `sessionId` fields on `ExecutorState` and the `shouldRetry` function in `Agent.Manager` are never used in the actual flow -- `PlannerOutputMissing` immediately fails the task. While keeping infrastructure for planned future work is acceptable, the `retryCount` and `sessionId` fields are initialized to `0` and `Nothing` respectively and never modified. The `AgentManager.shouldRetry` function is also never called. These unused code paths could confuse future readers. A comment on `ExecutorState` or on `handlePlannerComplete` explaining that retry is planned but not yet wired would help.
- **Suggestion:** Add a brief doc comment on the `retryCount` and `sessionId` fields noting they are scaffolding for future retry logic (Phase 5 of the plan). Alternatively, remove them now and re-add when retry is implemented, to keep the code minimal.

#### Suggestion 2: `plannerOutputHelpRecord` lists conditionally-required parameters as "optional"
- **File:** `packages/tools/src/Tools/Help.gren`
- **Line:** 315-334
- **Category:** Naming
- **Description:** The `plannerOutputHelpRecord` lists `summary`, `requirements`, `acceptanceCriteria`, `plan` as optional parameters. However, these are required when `type` is `"plan"`, and `questions` is required when `type` is `"questions"`, and `error` is required when `type` is `"error"`. The help text descriptions do note "(required for type 'plan')" etc., which partially mitigates this, but the structural categorization as "optional" could be misleading to an agent reading the help output. The `ToolHelp` type only has `required` and `optional` arrays, so there is no way to express conditional requirements within the current structure.
- **Suggestion:** Consider noting in the description field that "Parameters depend on the chosen type" or keep as-is since the per-parameter descriptions already clarify this. This is a minor readability point, not a structural issue.

#### Suggestion 3: `completionStatusStringDecoder` in ToolExecution duplicates `Types.completionStatusDecoder`
- **File:** `packages/chorus/src/Web/ToolExecution.gren`
- **Line:** 406-422
- **Category:** Duplication
- **Description:** `completionStatusStringDecoder` in ToolExecution.gren is functionally identical to `Types.completionStatusDecoder` (both decode a string into a `CompletionStatus` value via the same string matching). The ToolExecution version predates this change, but now that `completionStatusDecoder` is exported from Types (as noted in the dev report), the local copy should be replaced.
- **Suggestion:** Replace `completionStatusStringDecoder` with `Types.completionStatusDecoder` in `completionReportInputDecoder`.

#### Suggestion 4: `dispatchPlanner` stores an empty-instructions `InternalAgent` on executor state
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 2632
- **Category:** Correctness
- **Description:** The executor state for the planner is constructed with `agentConfig = InternalAgent { name = "task-validator", instructions = "" }` (line 2632) rather than the actual agent config that was loaded from the registry (which is only available inside the `GrenTask.andThen` chain). This means the `agentConfig` stored on the executor is not the real config. While `agentConfig` on the executor is primarily used for `handleUserAgentComplete` (which checks `agentConfig` for tool lists), the planner path does not use it in `handlePlannerComplete`. So this is not a bug currently, but it is a latent inconsistency: if future code inspects `executor.agentConfig` for a system agent, it will get the wrong instructions.
- **Suggestion:** Consider whether the actual loaded agent config can be stored on the executor. This would require restructuring `dispatchPlanner` to separate the executor creation from the command creation, or accepting the placeholder and adding a comment noting the limitation.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The two blocking issues must be addressed:

1. The duplicated completion report decoder in Main.gren should reuse the existing decoder from ToolExecution (or a shared location) instead of inlining a near-identical copy. Three versions of the same decoder with subtly different field-optionality semantics is a maintenance hazard.

2. The manual `Task` pattern match in `dispatchPlanner` for setting `currentAgent` should use the existing `Types.setCurrentAgent` helper to maintain consistency with the rest of the codebase.

Both fixes are straightforward and low-risk.
