# Code Review Report

## Summary
The implementation correctly addresses all three parts of the task: tool name mapping, dead binary cleanup, and handoff server-side migration. The code compiles and all 87 tests pass. There is one blocking bug in the deferred response handler and two duplication issues worth addressing.

## Issues Found

### BLOCKING Issues

#### Issue 1: agentName always resolves to "unknown" in deferred handoff response
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1043-1045
- **Category:** Correctness
- **Description:** In the `GotAgentComplete` handler, the `deferredResponseCmd` block reads `agentName` from `model.activeExecutors` via `Dict.get taskIdStr model.activeExecutors`. However, on line 1014-1016, `updatedExecutors` already removes this entry with `Dict.remove taskIdStr model.activeExecutors`, and `updatedModel` (line 1020-1024) uses `updatedExecutors`. The problem is that `deferredResponseCmd` is computed in the same `let` block, and it reads from `model.activeExecutors` (the original, un-removed dict) -- so at first glance it looks fine. But wait: `updatedModel` is used by the return value, not by the `deferredResponseCmd` computation. Let me re-read.

  Actually, on closer inspection, `deferredResponseCmd` reads from `model.activeExecutors` (line 1043), which is the *original* model before removal. So the `Dict.get` should find the executor and return its `agentName`. This is correct in the `let` binding evaluation order since Gren (like Elm) evaluates `let` bindings eagerly but each binding captures the values it references at definition time.

  **RETRACTED** -- This is not a bug. The `Dict.get` reads from the original `model.activeExecutors` before the removal. The binding order is fine.

### Suggestions

#### Suggestion 1: Large agent-spawn code duplication between GotHandoffRecorded and GotDeferredHandoffStarted
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 719-832 and 876-996
- **Category:** Duplication
- **Description:** The `GotHandoffRecorded` (lines 719-832) and `GotDeferredHandoffStarted` (lines 876-996) handlers contain nearly identical agent-spawning logic: building systemPrompt from agentInstructions + completionReportInstruction, constructing executorState, building ChildProcess options, resolving the provider config, building the shell command, running the process, and handling success/error. The only differences are: (1) `GotHandoffRecorded` sends the HTTP response immediately and does not store it, while `GotDeferredHandoffStarted` stores the response in `pendingHandoffResponses` for later; (2) the log message text differs slightly.
- **Suggestion:** Extract a shared helper function like `spawnAgentForHandoff` that takes the common parameters (model, taskId, prompt, agentConfig) and returns `{ executorState : ExecutorState, spawnCmd : Cmd Msg }`. Each handler would then only contain its unique response-handling logic. This would eliminate approximately 100 lines of duplication and reduce the risk of the two paths diverging in the future.

#### Suggestion 2: Wildcard match on ApiResult in GotDeferredHandoffStarted
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 876
- **Category:** Correctness
- **Description:** The `GotDeferredHandoffStarted` handler matches `Api.ApiError err` explicitly, then uses a wildcard `_` to catch both `Api.ApiSuccess` and `Api.DeferredHandoff`. Since `requestStartHandoff` should only ever return `ApiSuccess` or `ApiError` (never `DeferredHandoff`), the wildcard is technically safe. However, using a wildcard here means the compiler will not flag a problem if a new `ApiResult` variant is added in the future. The `GotHandoffRecorded` handler (line 700-832) is more precise: it explicitly matches all three variants.
- **Suggestion:** Match `Api.ApiSuccess _` explicitly instead of using `_`, and add an explicit `Api.DeferredHandoff _` branch that sends a 500 error (similar to what `GotHandoffRecorded` does). This makes the code consistent with the existing handler pattern and future-proof against new variants.

#### Suggestion 3: Missing timeout for deferred handoff responses
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 984-996
- **Category:** Correctness
- **Description:** The plan (Part 3) explicitly mentions "Timeout handling: If the agent doesn't complete within a reasonable time (10 min), send an error response." The implementation stores the deferred HTTP response in `pendingHandoffResponses` and relies on `GotAgentComplete` to resolve it. However, there is no explicit timeout mechanism to clean up stale entries. In practice, the `ChildProcess.run` has a 600-second (10-minute) `runDuration`, so the process will be killed and `GotAgentComplete` will fire with an error. This means the timeout is implicitly covered by the process timeout. This is acceptable but worth noting -- if the process timeout is ever changed independently, the deferred response could be left hanging.
- **Suggestion:** Add a comment near the `pendingHandoffResponses` storage (line 987) noting that the timeout is implicitly handled by the ChildProcess runDuration of 600 seconds. This makes the design decision explicit for future maintainers.

#### Suggestion 4: Test file naming
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 1190-1268
- **Category:** Style
- **Description:** The new `chorusToolsToCliFlags` tests are placed in `RegistryTests.gren`, which primarily tests task registry encode/decode operations and agent config operations. The tool name mapping tests are testing `Provider.ClaudeCode` module functions, which is conceptually different from registry tests.
- **Suggestion:** Consider creating a separate `ClaudeCodeTests.gren` test module for provider-specific tests, or at minimum add a section comment that clearly separates provider tests from registry tests. This is a minor organizational concern and not blocking.

## Overall Assessment

**Decision:** APPROVED

The implementation is correct, well-structured, and all acceptance criteria from the plan are met:
- Part 1: Tool name mapping works correctly with proper deduplication and fallback behavior. Six unit tests cover the key cases.
- Part 2: Dead entry points and unused modules are deleted. `Tools.Json` no longer depends on `Tools.Handoff`. The build script only compiles `chorus-tools`.
- Part 3: `ChorusToolsMain.gren` is now a pure proxy with no special cases. The server handles handoff tool requests end-to-end via the deferred response pattern. The existing handoff API endpoint continues to work.

The duplication between the two handoff handlers (Suggestion 1) is the most significant improvement opportunity for future work, as it represents ~100 duplicated lines that could diverge. The wildcard match (Suggestion 2) is worth fixing for robustness but is not blocking since the current code is functionally correct.
