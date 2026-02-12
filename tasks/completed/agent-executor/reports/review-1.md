# Code Review Report

## Summary

The implementation is well-structured overall, with a clean provider abstraction and reasonable code organization. There is one blocking issue related to duplicate type definitions that creates a maintainability problem, and several suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: Duplicate AgentSpec type definition
- **File:** `src/agent-executor/src/Provider.gren` (lines 46-49) and `src/agent-executor/src/Agent/Spec.gren` (lines 43-46)
- **Line:** Provider.gren:46, Agent/Spec.gren:43
- **Category:** Duplication
- **Description:** The `AgentSpec` type alias is defined identically in both modules. `Agent.Spec` defines it as the result of parsing markdown files, while `Provider` defines its own copy. This creates maintenance overhead where changes to the type must be made in two places, and could lead to subtle divergence over time.
- **Suggestion:** Remove the duplicate definition from `Provider.gren` and import it from `Agent.Spec` instead. The Provider module should `import Agent.Spec exposing (AgentSpec)` and re-export it if needed by other modules.

### Suggestions

#### Suggestion 1: Unused handlePortResponse function
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 280-282
- **Category:** Simplification
- **Description:** The `handlePortResponse` function is exported but appears to be a no-op - it simply returns the result passed to it without any transformation. The first parameter (`Msg`) is also unused.
- **Suggestion:** Either implement the intended functionality or remove this function if it's not needed. If it's a placeholder for future work, add a TODO comment explaining the intended purpose.

#### Suggestion 2: Project structure deviation from spec
- **File:** `src/sdk-bridge/` (directory location)
- **Line:** N/A
- **Category:** Style
- **Description:** The developer report notes that the SDK bridge is placed at `src/sdk-bridge/` as a separate top-level directory, whereas the task specification states it should be at `src/agent-executor/sdk-bridge/` as a subdirectory of agent-executor. This deviation affects how the projects are conceptually organized.
- **Suggestion:** Consider moving the SDK bridge to `src/agent-executor/sdk-bridge/` to match the task specification, or document the rationale for the deviation if there are good reasons for the current structure.

#### Suggestion 3: Hardcoded file-tools path
- **File:** `src/agent-executor/src/Main.gren`
- **Line:** 121-125
- **Category:** Correctness
- **Description:** The `findFileToolsPath` function returns a hardcoded relative path `"src/tools/build/file-tools"`. This will fail if the executor is run from a different working directory. The function's comment acknowledges this should be made configurable.
- **Suggestion:** Make the file-tools path configurable via command line argument or environment variable. Alternatively, use an absolute path based on the location of the agent-executor binary.

#### Suggestion 4: Empty system prompt on session resume
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 264
- **Category:** Correctness
- **Description:** When resuming a session in `parseResumeSessionResponse`, the `agentSpec.systemPrompt` is set to an empty string with a comment "Not stored on resume". This means resumed sessions may behave differently than fresh sessions if the system prompt is used anywhere after session creation.
- **Suggestion:** Either store the full agent spec with the session (in the TypeScript client), or ensure the calling code handles this case appropriately. Consider documenting this limitation.

#### Suggestion 5: Type parameter naming in Executor
- **File:** `src/agent-executor/src/Agent/Executor.gren`
- **Line:** 57-61
- **Category:** Naming
- **Description:** The `Config` type takes a type parameter `msg` but the parameter name is lowercase, which is the convention for values rather than types in many languages. While Gren allows this, using `Msg` would be more consistent with Gren conventions where type parameters are often capitalized.
- **Suggestion:** Consider renaming the type parameter to `Msg` for clarity: `type alias Config Msg = ...`

#### Suggestion 6: Error classification heuristic in parsePortError
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 163-185
- **Category:** Correctness
- **Description:** The `parsePortError` function classifies errors by checking if certain substrings ("auth", "rate", "network") appear in the error message. This heuristic is fragile - for example, a message like "Authentication failed: network timeout" would be classified as an authentication error due to string ordering.
- **Suggestion:** Consider using a more structured error format from the SDK bridge that includes an explicit error code, rather than parsing error messages. The TypeScript `ProviderError` type in `types.ts` already has an optional `code` field that could be used.

#### Suggestion 7: Tests could cover edge cases
- **File:** `src/sdk-bridge/src/client.test.ts`
- **Line:** 87-118
- **Category:** Correctness
- **Description:** The `submitToolResults` tests don't cover the case where tool results are submitted for a session that has no prior messages, or where results are submitted for tool calls that weren't actually requested. These edge cases could reveal issues in production.
- **Suggestion:** Add test cases for: (1) submitting tool results on a fresh session with no messages, (2) submitting results with tool call IDs that don't match pending calls.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The duplicate `AgentSpec` type definition must be addressed before merge to prevent maintenance issues. Having the same type defined in two places violates DRY principles and creates risk of the definitions diverging over time.

Additionally, the following should be considered before merge:
- The hardcoded file-tools path will cause issues in real deployment scenarios
- The empty system prompt on session resume could cause subtle behavioral differences

The suggestions regarding naming conventions and test coverage are lower priority but would improve the codebase quality.
