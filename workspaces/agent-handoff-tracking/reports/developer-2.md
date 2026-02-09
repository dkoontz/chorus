# Developer Report

## Task
Address review feedback from iteration 1: fix the blocking double HTTP response issue on StartHandoff, and apply the 7 suggestions from the code review.

## Files Modified
- `packages/chorus/src/Main.gren` - Restructured the `StartHandoff` handler to perform agent lookup first (via `GotAgentLookup`), then update the task only if the agent exists (via `GotHandoffRecorded`), then load the agent spec file (via `GotAgentSpecLoaded`), then spawn the CLI process. Added three new Msg variants: `GotHandoffRecorded`, `GotAgentSpecLoaded`. This eliminates the double-response race condition and ensures the task is never modified if the agent is not found. The agent spec file is now loaded and passed as `systemPrompt` when spawning.
- `packages/shared/Types.gren` - Moved `setAgentChain` mutator here from `Web.Api`, exposed it from the module alongside other task mutators.
- `packages/chorus/src/Web/Api.gren` - Removed duplicate `setAgentChain` (now imported from `Types`). Removed duplicate `encodeAgentConfig` (now imported from `Agent.Registry`).
- `packages/chorus/src/Agent/Registry.gren` - Exposed `encodeAgentConfig` from the module. Updated default `allowedTools` for all five agent configs from `"Bash(file-tools *)"` to `"Bash(file-tools * scripts/agent/*)"` so agents can invoke the handoff script.
- `packages/chorus/src/Provider/ClaudeCode.gren` - Applied `escapeForShell` to `permMode` in `buildShellCommand` (was concatenated unescaped).
- `.claude/settings.json` - Added `"Bash(scripts/agent/handoff.sh *)"` to the permission allowlist as required by the task spec.
- `packages/chorus/tests/integration/IntegrationRunner.gren` - Added `testTaskSummaryIncludesCurrentAgent` integration test that creates a task, sets `currentAgent`, then reads `registry.json` and verifies the summary includes the `currentAgent` field.

## Build Status
**Status:** PASS

```
Success! Compiled 13 modules.
```

## Test Status
**Status:** PASS

Unit tests: 29 passed, 0 failed
Integration tests: 19 passed, 0 failed

## Implementation Notes

### Blocking Issue Fix (Issue 1)
The StartHandoff flow was restructured from a parallel `Cmd.batch` (task update + agent lookup) into a sequential chain:
1. `handleRoute` dispatches `AgentRegistry.getAgent` -> `GotAgentLookup`
2. `GotAgentLookup`: if agent found, calls `Api.requestStartHandoff` -> `GotHandoffRecorded`; if not found, sends error response (task is never modified)
3. `GotHandoffRecorded`: sends the HTTP response, then reads the agent spec file -> `GotAgentSpecLoaded`
4. `GotAgentSpecLoaded`: passes spec content as `systemPrompt` in `CliArgs`, spawns the CLI process

This ensures only one HTTP response is sent per request, and the task is only modified after the agent is confirmed to exist.

### Suggestion 1: setAgentChain moved to Types.gren
Now alongside `setCurrentAgent`, `setTaskStatus`, and `setAttachments`.

### Suggestion 2: encodeAgentConfig deduplicated
Exposed from `Agent.Registry` and imported in `Web.Api`.

### Suggestion 3: permMode shell-escaped
Applied `escapeForShell` to `permMode` in `buildShellCommand`.

### Suggestion 4: handoff.sh allowlist
Updated default `allowedTools` in seed configs to `"Bash(file-tools * scripts/agent/*)"` so agents can run the handoff script. Also added `"Bash(scripts/agent/handoff.sh *)"` to `.claude/settings.json`.

### Suggestion 5: testTaskSummaryIncludesCurrentAgent
Added as an integration test since `TaskSummary` and its encoder/decoder are internal to `Task.Registry`. The test creates a task, sets `currentAgent` via `updateTask`, then reads `registry.json` directly and decodes the `currentAgent` field from the task summary.

### Suggestion 6: deduplicateStrings O(n^2)
Not changed. The reviewer noted this is not a practical concern for the expected input sizes (1-5 items).

### Suggestion 7: Agent spec loaded as system prompt
Implemented as part of the blocking issue fix. The `GotAgentSpecLoaded` handler reads the spec file and passes its content as `systemPrompt` to the CLI. If the file is missing or unreadable, the agent proceeds without a system prompt.

## Iteration
2
