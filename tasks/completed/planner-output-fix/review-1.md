# Code Review Report

## Summary

The implementation correctly addresses both goals: adding chorus-tools CLI invocation format to the task-validator instructions and wiring session resume retry for `PlannerOutputMissing`. The code is well-structured, follows existing patterns, and the developer correctly handled the critical detail of using `model` instead of `updatedModel` for the retry path. Build and tests pass.

## Issues Found

### BLOCKING Issues

No blocking issues found.

### Suggestions

#### Suggestion 1: Duplicated CLI result parsing between ClaudeCode and OpenCode
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren` and `packages/chorus/src/Provider/OpenCode.gren`
- **Line:** ClaudeCode 122-145, OpenCode 118-141
- **Category:** Duplication
- **Description:** The `session_id` extraction from JSON output follows the exact same pattern in both providers (decode `"result"` field, decode `"session_id"` field, construct `AgentCompleted` record). The `deliverToolResults` and `handleHttpToolCall` functions were already duplicated before this change, but this patch adds more shared logic (the `session_id` extraction block). The OpenCode dev report mentions extracting `runCli` as a shared binding within the file, which is good, but the duplication across the two providers continues to grow.
- **Suggestion:** Consider extracting a shared helper (e.g., in a `Provider.CliCommon` module) for parsing CLI output into `{ resultText : String, sessionId : Maybe String }`. This is not urgent since both providers are thin wrappers, but it would reduce the surface area for future divergence.

#### Suggestion 2: The `systemPrompt` field is set to empty string on resume in `handlePlannerComplete`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 3255-3258
- **Category:** Correctness
- **Description:** In the resume `StartConfig`, `systemPrompt` is set to `""` (empty string). The ClaudeCode provider correctly skips `--system-prompt` when `resumeSessionId` is `Just _` (ignoring `systemPrompt` entirely), so this empty string is harmless for ClaudeCode. However, the OpenCode provider does not check `systemPrompt` at all on resume — it only checks `resumeSessionId` to skip the `AGENTS.md` write. If the retry logic were ever triggered for an API provider or a future CLI provider that uses `systemPrompt` differently, the empty string could be problematic. The plan specified `systemPrompt = Nothing` in the provider-level logic, which the ClaudeCode provider correctly implements. The Main.gren resume path using `""` is fine as-is because it flows through the provider's `startConfig.resumeSessionId` guard, but using a more clearly intentional value or adding a comment would improve clarity.
- **Suggestion:** Add a brief comment on line 3257 explaining that `systemPrompt` is intentionally empty here because the provider skips it when `resumeSessionId` is set.

#### Suggestion 3: The `allowedTools` field is `Nothing` in the resume `StartConfig`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 3262
- **Category:** Correctness
- **Description:** When retrying in `handlePlannerComplete`, `allowedTools` is set to `Nothing`. For the initial spawn of internal agents (task-validator), `allowedTools` is also `Nothing` (line 452-453), so this is consistent. However, it is worth noting that `Nothing` causes `ClaudeCode.chorusToolsToCliFlags` to fall back to the default `Bash(chorusToolsPath *)` pattern (which grants full Bash access to chorus-tools). This matches what the initial spawn does for internal agents, so it is correct, but it relies on an implicit fallback rather than explicitly carrying the original `allowedTools` value through to the retry.
- **Suggestion:** No change needed, but a comment noting this is intentionally matching the initial spawn behavior for internal agents would be helpful for future readers.

## Overall Assessment

**Decision:** APPROVED

The implementation is clean, correct, and follows the plan precisely. The type changes to `AgentCompleted` and `StartConfig` are properly threaded through all affected code paths. The session ID extraction, storage, and retry logic are well-structured. The critical detail of using `model` instead of `updatedModel` in the retry path is correctly handled, preserving the executor in `activeExecutors`. The OpenCode refactoring to extract `runCli` as a shared binding reduces nesting and improves readability. The suggestions above are minor improvements for future maintainability, not required for merge.
