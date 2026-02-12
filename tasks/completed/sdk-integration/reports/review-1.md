# Code Review Report

## Summary
The implementation successfully replaces the SDK bridge with direct CLI spawning. The code is well-structured with clear separation of concerns. However, there is one blocking issue where the executor does not call `validateEnvironment` as required by the task specification, and several suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: Executor does not call validateEnvironment before session creation
- **File:** `src/agent-executor/src/Agent/Executor.gren`
- **Line:** 179-183
- **Category:** Correctness
- **Description:** The task specification requires "Executor calls `validateEnvironment` before attempting to create sessions." However, the executor directly calls `createSession` when the agent spec is loaded without first validating the environment. This means users will receive unclear error messages if the `claude` CLI or `file-tools` binary is missing.
- **Suggestion:** Add a validation step in the `AgentSpecLoaded` message handler. Before calling `createSession`, first call `validateEnvironment`. This could be done by adding a new state like `Validating { agentSpec : AgentSpec }` or by calling validation first and then session creation upon success.

### Suggestions

#### Suggestion 1: Missing unit tests for JSON parsing logic
- **File:** `src/agent-executor/tests/unit/Main.gren`
- **Line:** N/A (missing tests)
- **Category:** Correctness
- **Description:** The task specification requires "Unit tests for JSON parsing for each message type (system, assistant, user, result)" and "Test command argument building for new sessions vs resume." The current test suite only tests `Agent.Spec` parsing and does not include tests for the new `parseSessionId`, `parseCliResponse`, `parseStreamJsonResponse`, `extractAssistantText`, or `buildCliArgs` functions in `ClaudeCode.gren`.
- **Suggestion:** Add a new test module `ClaudeCodeTests.gren` with tests covering:
  - `parseSessionId` with batch JSON and streaming NDJSON inputs
  - `parseCliResponse` with success and error results
  - `parseStreamJsonResponse` with various message types
  - `buildCliArgs` for new sessions vs resume scenarios

#### Suggestion 2: Inconsistent error detection in validateEnvironment
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 84-112
- **Category:** Correctness
- **Description:** The `validateEnvironment` function runs `claude --version` followed by `file-tools --help`. If the first command succeeds but the second fails, the error message will incorrectly say "claude CLI not found" (due to the `Task.mapError` applying to both). The error mapping doesn't distinguish which binary failed.
- **Suggestion:** Either chain the tasks with separate error handlers, or use a more explicit approach where each check has its own specific error message. For example:
  ```gren
  ChildProcess.run ... "claude" ...
      |> Task.mapError (\e -> mapClaudeCliError e)
      |> Task.andThen (\_ ->
          ChildProcess.run ... fileToolsPath ...
              |> Task.mapError (\e -> mapFileToolsError e)
      )
  ```

#### Suggestion 3: workspaceRoot not passed on session resume messages
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 187
- **Category:** Correctness
- **Description:** When sending messages via `sendMessage`, the `workspaceRoot` is set to an empty string with the comment "Not needed for resume." However, the CLI's `--add-dir` flag ensures the workspace is accessible to file-tools. By not passing this on resume, the resumed session may not have access to the workspace directory if the CLI doesn't persist this from the original session.
- **Suggestion:** Consider storing the `workspaceRoot` in the `Session` type or always passing it when building CLI args for message sends. Verify with the CLI documentation whether `--add-dir` persists across `--resume` or needs to be specified each time.

#### Suggestion 4: Empty string check could be more explicit
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 309-313
- **Category:** Style
- **Description:** The check `if String.isEmpty args.workspaceRoot then` to conditionally add `--add-dir` relies on empty string being passed when not needed. This is somewhat implicit.
- **Suggestion:** Consider using `Maybe String` for `workspaceRoot` in `CliArgs` to make the optionality explicit, matching the pattern used for `systemPrompt` and `resumeSessionId`.

#### Suggestion 5: Consider extracting timeout constants
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 81, 148, 197
- **Category:** Style
- **Description:** Timeout values (5000ms, 120000ms, 600000ms) are hardcoded in multiple places. The developer report mentions these as design decisions ("2 minutes for session creation, 10 minutes for message sending") but they're embedded in the code without named constants.
- **Suggestion:** Define named constants at the module level:
  ```gren
  validationTimeoutMs = 5000
  sessionCreationTimeoutMs = 120000
  messageSendTimeoutMs = 600000
  ```

#### Suggestion 6: submitToolResults error message could be more descriptive
- **File:** `src/agent-executor/src/Provider/ClaudeCode.gren`
- **Line:** 228-237
- **Category:** Naming
- **Description:** The error type `InvalidResponseError` is used for `submitToolResults`, but this is not actually an invalid response - it's an intentionally unsupported operation. The error message is good, but the error type doesn't accurately describe the situation.
- **Suggestion:** Consider adding a new error type like `UnsupportedOperationError` to the `ProviderError` type, or use `ProviderNotAvailable` with a reason that explains the CLI handles tools internally.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The implementation is well-structured and follows the architecture specified in the task. The CLI spawning, JSON parsing, and session management logic are implemented correctly. However, the following must be addressed:

1. **Required:** The executor must call `validateEnvironment` before session creation. This is explicitly listed as an acceptance criterion: "Executor calls `validateEnvironment` before attempting to create sessions."

The suggestions above would improve code quality but are not required for merge. In particular, adding unit tests for the JSON parsing logic (Suggestion 1) is strongly recommended for long-term maintainability.
