# Code Review Report

## Summary

The implementation successfully replaces external agent spec files with inline instructions, adds full agent CRUD (create/read/update/delete) across backend and UI, and removes `workspacePath` from task types. The code is well-structured and follows project conventions. A few issues were found, one blocking and several suggestions.

## Issues Found

### BLOCKING Issues

#### Issue 1: `requestCreateAgent` does not check for existing agent before creating
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 866-882
- **Category:** Correctness
- **Description:** The `requestCreateAgent` function calls `AgentRegistry.updateAgent` directly, which is a create-or-update (upsert) operation. This means `POST /api/agents` (create) silently overwrites an existing agent if one with the same name already exists. A create operation should fail with a 409 Conflict if the agent already exists, just like `requestStartHandoff` does when a handoff is already in progress. Without this check, a client could accidentally overwrite an existing agent's configuration with no warning.
- **Suggestion:** Before calling `AgentRegistry.updateAgent`, first call `AgentRegistry.getAgent` to check if an agent with that name already exists. If it does, return `ApiError { statusCode = 409, code = "CONFLICT", message = "Agent already exists: " ++ agentConfig.name }`. Alternatively, add a dedicated `createAgent` function to `Agent.Registry` that checks for existence before writing.

### Suggestions

#### Suggestion 1: Duplication between `getAgent` and `readAgentConfigFile` in Agent.Registry
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 152-185 and 293-310
- **Category:** Duplication
- **Description:** The `getAgent` function contains file-reading and JSON-decoding logic that is almost identical to the private `readAgentConfigFile` helper. The only addition in `getAgent` is the ENOENT-to-AgentNotFound error mapping. The core read-and-decode logic is duplicated.
- **Suggestion:** Refactor `getAgent` to call `readAgentConfigFile` internally, then add the ENOENT-to-AgentNotFound mapping via `GrenTask.onError`. This would reduce ~20 lines of duplication.

#### Suggestion 2: `deleteAgent` does not guard against deleting seed/built-in agents
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 229-249
- **Category:** Correctness
- **Description:** The `deleteAgent` function allows deleting any agent including the five seed agents (developer, developer-review, qa, planner, orchestrator). While this may be intentional, there is no confirmation or warning. If all seed agents are deleted, the system has no agents to hand off to. This is a minor concern since the agents page clearly shows what is being deleted, but worth noting.
- **Suggestion:** Consider whether deleting built-in agents should be protected or if the seed-on-empty-directory mechanism is sufficient recovery. If the current behavior is intentional, a brief code comment explaining the rationale would be helpful.

#### Suggestion 3: UI `deleteAgent` has no confirmation dialog
- **File:** `packages/chorus-ui/src/View/Agents.gren`
- **Line:** 100-104
- **Category:** Correctness
- **Description:** The Delete button on each agent card directly triggers `onDeleteAgent` without any confirmation prompt. Since deletion is destructive and immediate, an accidental click could remove an agent's configuration permanently.
- **Suggestion:** Add a confirmation step before deleting, either through a browser `window.confirm` dialog (via ports) or an in-app confirmation modal, similar to how the task create modal works.

#### Suggestion 4: Backward-compatible decoder fallback is overly permissive
- **File:** `packages/shared/Types.gren`
- **Line:** 892-897
- **Category:** Correctness
- **Description:** The `agentConfigDecoder` uses `Decode.oneOf [ Decode.field "instructions" Decode.string, Decode.succeed "" ]` for the instructions field. The `Decode.succeed ""` fallback will succeed for any JSON, not just old-format JSON with `specPath`. This means a completely malformed agent JSON (e.g., missing all fields except `name`, `allowedTools`, `permissionMode`) would decode with empty instructions, hiding the fact that the data is corrupted. This is documented as intentional for backward compatibility, but it slightly violates the project's "Fail on Malformed or Missing Data" coding standard.
- **Suggestion:** A more targeted fallback would be: `Decode.oneOf [ Decode.field "instructions" Decode.string, Decode.field "specPath" Decode.string |> Decode.map (\_ -> ""), Decode.succeed "" ]`. The middle branch explicitly matches the old format so the final fallback is less likely to mask corruption. However, since the developer report documents this as intentional and the migration window is presumably short, this is a minor concern.

#### Suggestion 5: `sendBadRequest` does not escape JSON in the message
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 782-788
- **Category:** Correctness
- **Description:** The `sendBadRequest` function builds a JSON string by concatenation: `"{\"error\":{\"code\":\"BAD_REQUEST\",\"message\":\"" ++ message ++ "\"}}"`. If `message` contains a double quote or backslash, this produces invalid JSON. The same pattern is used in `sendServiceUnavailable` and `sendNotFound` but those use static strings so are not affected.
- **Suggestion:** Use `Json.Encode` to build the response body properly, similar to how `sendApiResponse` constructs error responses in `Web/Api.gren`. This ensures all special characters are escaped correctly.

#### Suggestion 6: Agent executor `status` starts as `ExecRunning` rather than `ExecStarting`
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 387
- **Category:** Naming
- **Description:** When creating the `executorState` in `GotHandoffRecorded`, the status is set to `ExecRunning` even though the agent process has not yet started (the `ChildProcess.run` command is batched alongside). The `ExecStarting` status exists but is never used.
- **Suggestion:** Set the initial status to `ExecStarting` when the executor state is created, and transition to `ExecRunning` when appropriate (or remove `ExecStarting` if it's not needed). Currently this is cosmetic since the executor status doesn't appear to be read externally, but using the correct state avoids confusion.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue is that `POST /api/agents` (create) silently overwrites an existing agent because it delegates to the upsert `updateAgent` registry function without first checking for existence. This should be fixed to return a 409 Conflict when attempting to create an agent that already exists. The remaining suggestions are non-blocking improvements that would be worth considering in this or future work.
