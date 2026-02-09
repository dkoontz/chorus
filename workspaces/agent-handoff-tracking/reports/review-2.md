# Code Review Report

## Summary

The iteration 2 changes address the blocking issue from review 1 (double HTTP response race condition on StartHandoff) and five of the seven suggestions. The restructured sequential flow in `Main.gren` is correct and eliminates both the double-response and the stuck-task problems. No blocking issues remain.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: `GotAgentSpecLoaded` silently swallows file-read errors
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 404-413
- **Category:** Correctness
- **Description:** When the agent spec file cannot be read, the `GotAgentSpecLoaded` handler silently falls back to an empty string and proceeds to spawn the agent without a system prompt. The developer report mentions this is intentional ("If the file is missing or unreadable, the agent proceeds without a system prompt"), but this means a typo in `specPath` (e.g., `"agents/devloper.md"`) would silently result in an agent running without its role instructions. The agent would still run, but without the constraints and context that the spec file provides. A log message would make this debuggable.
- **Suggestion:** Add a `Logging.logWarn` call when `result` is `Err _` or when `specContent` is empty, so operators can see that an agent was spawned without its spec. This does not require changing the spawn behavior, only adding visibility.

#### Suggestion 2: `toolCliFlagFromAllowedTools` splits on space inside parenthesized groups
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 443-470
- **Category:** Correctness
- **Description:** The function splits the `allowedTools` string on spaces, then strips parenthesized portions from each token. For the current default `"Bash(file-tools * scripts/agent/*)"`, this produces tokens `["Bash(file-tools", "*", "scripts/agent/*)"]`. The first token yields `"Bash"` (correct), and the second token `"*"` yields `"*"` which becomes an extra entry in the tools flag. The third token `"scripts/agent/*)"` yields `"scripts/agent/*)"` (with trailing paren). After deduplication, the result is `"Bash * scripts/agent/*)"` instead of the expected `"Bash"`. The `--tools` flag passed to the CLI would thus be `Bash * scripts/agent/*)` rather than `Bash`. This may or may not cause issues depending on how the Claude CLI interprets extra `--tools` values, but the output does not match the documented behavior ("extracts tool category names").
- **Suggestion:** The parsing needs to handle the content inside parentheses as a single group rather than splitting on spaces within them. One approach: iterate through the string tracking parenthesis depth, splitting only on spaces outside parentheses. Then strip the `(...)` suffix from each top-level token. For the current seed configs, this would correctly produce `"Bash"` from `"Bash(file-tools * scripts/agent/*)"`.

#### Suggestion 3: `buildCliArgs` does not shell-escape in its array output
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 309-367
- **Category:** Style
- **Description:** `buildCliArgs` builds an array of raw argument strings (used for error messages and the `createSession`/`sendMessage` functions), while `buildShellCommand` builds a single shell command string with proper escaping. In `Main.gren` (line 452), the agent spawn calls `ChildProcess.run` with `"bash"` and `["-c", shellCommand]` where `shellCommand` comes from `buildShellCommand`. This is correct -- the shell command has escaping. The `buildCliArgs` function is only used for error context in `cliErrorToProviderError`. No issue here, just noting the two functions serve different purposes and the right one is used for execution.
- **Suggestion:** No change needed. The code correctly uses `buildShellCommand` for execution and `buildCliArgs` only for diagnostics.

#### Suggestion 4: `listTasks` endpoint returns full task objects instead of summaries
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 118-145
- **Category:** Simplification
- **Description:** The `GET /api/tasks` endpoint reads the registry index (which contains `TaskSummary` records), then loads each full task from disk, and encodes the full task objects. For a kanban board that only needs summaries, this loads more data than necessary. The `TaskSummary` now includes `currentAgent`, which is the field the kanban board needs. Returning summaries directly from the index would reduce disk I/O. This is an existing pattern predating this task and not introduced by this change, so it is not a regression.
- **Suggestion:** Consider a future endpoint (e.g., `GET /api/tasks?view=summary`) that returns `TaskSummary` records directly from the registry index without loading each task file. This would reduce latency for the kanban board.

## Overall Assessment

**Decision:** APPROVED

The blocking issue from review 1 has been addressed correctly. The sequential chain (`GotAgentLookup` -> `GotHandoffRecorded` -> `GotAgentSpecLoaded` -> spawn) ensures that the agent is validated before the task is modified, and only one HTTP response is sent per request. The error paths now return early without touching the task state.

The five addressed suggestions are all done well:
- `setAgentChain` is properly located in `Types.gren` alongside other mutators.
- `encodeAgentConfig` is exposed from `Agent.Registry` and imported in `Web.Api`, removing the duplicate.
- `permMode` is now shell-escaped in `buildShellCommand`.
- `handoff.sh` is in the `.claude/settings.json` allowlist, and the default `allowedTools` in seed configs now includes `scripts/agent/*`.
- The `testTaskSummaryIncludesCurrentAgent` integration test is a practical approach given that `TaskSummary` is internal to `Task.Registry`.

Suggestion 2 above (the `toolCliFlagFromAllowedTools` parsing) is worth addressing in a future iteration, as the current implementation produces incorrect output for `allowedTools` strings that contain spaces inside parentheses. The impact depends on how the Claude CLI handles extra `--tools` values, but the function's documented behavior does not match its actual output for the current seed configs.
