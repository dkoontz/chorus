# Code Review Report

## Summary

The implementation covers all seven parts of the task specification: data model changes, agent registry, API endpoints, execution wiring, CLI script, agent spec updates, and unit tests. The build compiles (13 modules) and all tests pass (29 unit, 18 integration). There is one blocking issue related to a double-response race condition in the handoff endpoint, and several suggestions for improvement.

## Issues Found

### BLOCKING Issues

#### Issue 1: Double HTTP response on StartHandoff route
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 633-647
- **Category:** Correctness
- **Description:** The `Router.StartHandoff` handler dispatches two concurrent commands via `Cmd.batch`: (1) `Api.requestStartHandoff`, which updates the task and sends an HTTP response via `toMsg` -> `GotApiResult`, and (2) `AgentRegistry.getAgent`, which on error or "not found" also sends an HTTP response via the `response` object in `GotAgentLookup`. This means the same HTTP response object receives two writes -- the first from `requestStartHandoff` (always), and a second from `GotAgentLookup` if the agent is not found or there's an error. Writing to an already-sent response will likely cause a runtime error or silent failure. Even in the success path, both fire: `requestStartHandoff` sends the updated task JSON, and `GotAgentLookup` (on success) spawns the agent but does not send a response -- so in the happy case it works, but the error paths are broken. Additionally, if the agent lookup fails, the task has already been updated with `currentAgent` set and a chain entry appended, but no agent will actually be spawned, leaving the task in a stuck state with `currentAgent` set and no agent running.
- **Suggestion:** Restructure so that the agent lookup happens first. Only if the agent is found, proceed with `requestStartHandoff` and then spawn the agent. This could be done by: (a) moving agent lookup to happen before the task update (look up the agent config, then update the task, then spawn), or (b) having `GotAgentLookup` on success trigger the `requestStartHandoff` call followed by the spawn. The HTTP response should only be sent once per request. In the error path, the task should not be modified.

### Suggestions

#### Suggestion 1: `setAgentChain` should be in `Types.gren`, not `Web.Api`
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 856-863
- **Category:** Duplication / Style
- **Description:** The `setAgentChain` function follows the same accessor/mutator pattern as `setCurrentAgent`, `setTaskStatus`, and `setAttachments` in `Types.gren`. Placing it in `Web.Api` as an internal helper breaks the convention and means any other module needing to set the agent chain would have to duplicate it.
- **Suggestion:** Move `setAgentChain` to `Types.gren` alongside the other task mutators and expose it from the module. Then import and use it from `Web.Api`.

#### Suggestion 2: Duplicate `encodeAgentConfig` between `Agent.Registry` and `Web.Api`
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 844-851
- **Category:** Duplication
- **Description:** `encodeAgentConfig` exists in both `Agent.Registry` (line 294, not exposed) and `Web.Api` (line 844). The implementations are identical. This is a maintenance risk if fields are added to `AgentConfig` later.
- **Suggestion:** Expose `encodeAgentConfig` from `Agent.Registry` and import it in `Web.Api` instead of defining a duplicate.

#### Suggestion 3: `permMode` not shell-escaped in `buildShellCommand`
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 417
- **Category:** Correctness
- **Description:** In `buildShellCommand`, the `toolsFlag` and `allowedToolsValue` are escaped with `escapeForShell`, but `permMode` is concatenated directly without escaping. While the current default values (`"bypassPermissions"`, `"default"`) contain no special characters, the value comes from a JSON config file in `data/agents/`. If a malformed or edited config file contains shell metacharacters in `permissionMode`, it would be interpreted by the shell.
- **Suggestion:** Apply `escapeForShell` to `permMode` as well: `" --permission-mode " ++ escapeForShell permMode`. This costs nothing and closes the gap.

#### Suggestion 4: `handoff.sh` missing from `.claude/settings.json` allowlist
- **File:** `.claude/settings.json`
- **Line:** 16-54
- **Category:** Correctness
- **Description:** The task specification (Part 5) explicitly requires adding `scripts/agent/handoff.sh` to the Bash permission allowlist in `.claude/settings.json`. The developer report notes this was intentionally skipped because "agents receive permissions via CLI flags when spawned, not via the settings file." However, when an agent running inside a Claude CLI session invokes `scripts/agent/handoff.sh` as a Bash tool, it will be subject to the permission rules in `.claude/settings.json` (or the `--allowedTools` flag). The current `allowedTools` value for all agents is `"Bash(file-tools *)"`, which only permits running `file-tools`. The handoff script would be blocked unless the allowedTools is updated to also permit it.
- **Suggestion:** Either (a) add `"Bash(scripts/agent/handoff.sh *)"` to the settings allowlist, or (b) update the default `allowedTools` in the agent seed configs to include the handoff script (e.g., `"Bash(file-tools * scripts/agent/*)"` or a similar pattern). Without this, agents will not be able to invoke the handoff script in practice.

#### Suggestion 5: Missing `testTaskSummaryIncludesCurrentAgent` unit test
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** N/A
- **Category:** Correctness
- **Description:** The task specification (Part 7) lists `testTaskSummaryIncludesCurrentAgent` as a required test: "create a task summary with `currentAgent` set, encode, decode, verify." The `TaskSummary` type and its encoder/decoder are internal to `Task.Registry` and not directly testable from the unit test module (which imports `Types`), so this might have been skipped for that reason. However, it is listed as a requirement.
- **Suggestion:** Consider adding an integration test that creates a task, sets `currentAgent`, then fetches the task list endpoint and verifies `currentAgent` appears in the summary. Alternatively, expose `TaskSummary`, `encodeTaskSummary`, and `taskSummaryDecoder` from `Task.Registry` to enable a direct unit test.

#### Suggestion 6: `deduplicateStrings` uses O(n^2) array membership check
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 475-487
- **Category:** Simplification
- **Description:** `deduplicateStrings` checks `Array.member item seen` on each iteration, which is O(n) per check, making the overall function O(n^2). For the small inputs expected (tool lists with 1-5 items), this is not a practical concern. Noting for awareness only.
- **Suggestion:** No change needed for current usage. If tool lists grow significantly, a `Dict`-based approach would be more efficient.

#### Suggestion 7: Agent spec file not loaded before spawning
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 337-345
- **Category:** Correctness
- **Description:** In `GotAgentLookup`, the `CliArgs` are built with `systemPrompt = Nothing`. The task spec (Part 4, step 3) says "Load the agent spec from the spec file path." The `agentConfig.specPath` is available but the spec file is not read and its content is not used as a system prompt. This means agents spawned via handoff will not receive their agent spec as a system prompt -- they will only get the bare prompt message. The agents will still function (the Claude CLI may pick up local project instructions), but they won't have the specific role instructions from their spec files.
- **Suggestion:** Before spawning the agent, read the spec file from `agentConfig.specPath` and pass its content as `systemPrompt = Just specContent` in the `CliArgs`. This requires a filesystem read step between the agent lookup and the CLI spawn, which means the spawn logic would need to be restructured as a `GrenTask` chain rather than happening directly in the `GotAgentLookup` handler.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue (double HTTP response / race condition in `StartHandoff`) must be fixed. In the current implementation, if the agent is not found, the task gets incorrectly updated (currentAgent set, chain entry appended) but no agent is spawned, and two HTTP responses are attempted on the same connection. The fix is to restructure so that agent lookup happens first, and the task update only proceeds if the agent exists.

Suggestion 4 (handoff script not in allowlist / allowedTools) and Suggestion 7 (agent spec not loaded as system prompt) are also worth addressing as they affect whether the feature works end-to-end, though they are not structural bugs in the code itself.
