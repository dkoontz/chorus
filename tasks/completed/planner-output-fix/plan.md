# Fix planner-output tool invocation and add session resume retry

## Context

The task-validator system agent fails to call the `planner-output` tool, causing tasks to immediately fail with "Planner exited without calling planner-output tool". Two root causes:

1. **Missing invocation instructions.** The task-validator's system prompt says "call the planner-output tool" and shows raw JSON examples, but never explains that tools are invoked via the `chorus-tools` CLI binary through Bash. User-defined agents get a tool context section from `toolContextForAgent` with the `chorus-tools <workspace-root> '{"tool": ...}'` format — internal agents get none (`toolContext = ""` in Main.gren:424).

2. **No retry on missing tool call.** When the CLI agent exits without calling planner-output, `handlePlannerComplete` (Main.gren:3217) immediately marks the task as `Failed`. The Claude CLI outputs a `session_id` in its JSON response, and supports `--resume <sessionId>` to continue a session. The scaffolding for retry (`ExecutorState.sessionId`, `ExecutorState.retryCount`, `AgentManager.shouldRetry`) already exists but is not wired in.

## Fix 1: Add chorus-tools invocation format to task-validator instructions

### `packages/chorus/src/Agent/Registry.gren`

Update `taskValidatorInstructions` (line 250-252). Replace the raw JSON examples with `chorus-tools` Bash invocations matching the format from `ToolContext.gren:39-40`:

```
chorus-tools <workspace-root> '{"tool": "planner-output", "type": "plan", ...}'
```

### `packages/chorus/src/Main.gren`

Update `outputToolInstruction` for system agents (line 431-432). Change from:

```
"\n\nRemember: you must call the planner-output tool before finishing."
```

To include the invocation format hint:

```
"\n\nRemember: you must call the planner-output tool via chorus-tools before finishing. Use Bash to invoke:\nchorus-tools <workspace-root> '{\"tool\": \"planner-output\", ...}'"
```

## Fix 2: Resume session on PlannerOutputMissing

Thread the CLI `session_id` from agent output through to retry logic. On `PlannerOutputMissing`, resume the session with a reminder message instead of failing. Limit to 1 retry.

### Type changes

**`packages/chorus/src/Provider.gren`**

1. `AgentCompleted String` becomes `AgentCompleted { output : String, sessionId : Maybe String }` (line 237)
2. Add `resumeSessionId : Maybe String` to `StartConfig` (lines 221-228)

`Executor.AgentCompleted` stays as `String` — the executor doesn't need the session ID. Main.gren extracts it from the provider event before forwarding only the output to the executor.

### CLI providers extract session_id

**`packages/chorus/src/Provider/ClaudeCode.gren`** (lines 87-157)

1. Use `startConfig.resumeSessionId` for `cliArgs.resumeSessionId` instead of hardcoded `Nothing` (line 94)
2. When resuming (`resumeSessionId /= Nothing`): set `systemPrompt = Nothing` to avoid re-sending (the session already has one)
3. Extract `session_id` from JSON output alongside `result`:
   ```gren
   sessionId =
       when Decode.decodeString (Decode.field "session_id" Decode.string) output is
           Ok sid -> Just sid
           Err _ -> Nothing
   ```
4. Emit `AgentCompleted { output = resultText, sessionId = sessionId }`

**`packages/chorus/src/Provider/OpenCode.gren`** (lines 87-150)

Same pattern as ClaudeCode:
1. Use `startConfig.resumeSessionId` for `cliArgs.sessionId` instead of hardcoded `Nothing` (line 97)
2. When resuming: skip the `FileSystem.writeFile` for AGENTS.md — go straight to `ChildProcess.run`
3. Extract `session_id` from JSON output
4. Emit `AgentCompleted { output = resultText, sessionId = sessionId }`

### Store session ID and retry

**`packages/chorus/src/Main.gren`**

1. **`handleProviderEvent`** (lines 2557-2575): Extract `sessionId` from `Provider.AgentCompleted { output, sessionId }`, store on `ExecutorState.sessionId`, forward only `output` string to `Executor.AgentCompleted`.

2. **`spawnAgent`** (lines 485-495): Add `resumeSessionId = Nothing` to `StartConfig` construction (initial spawn never resumes).

3. **`handlePlannerComplete`** — `PlannerOutputMissing` branch (lines 3217-3245): Replace immediate failure with retry logic:
   - If `AgentManager.shouldRetry { retryCount = executor.retryCount, maxRetries = 1 }` AND `executor.sessionId` is `Just`:
     - Re-spawn via `executor.provider.startAgent` with `resumeSessionId = executor.sessionId` and a reminder message
     - Increment `retryCount`, reset `executorModel` to `Idle`, clear `sessionId`
     - Use `model` (NOT `updatedModel` which removes the executor from `activeExecutors` at line 3120)
   - Otherwise: fail as before (existing code)

## Files changed

| File | Changes |
|------|---------|
| `packages/chorus/src/Agent/Registry.gren` | `taskValidatorInstructions` — chorus-tools invocation format |
| `packages/chorus/src/Provider.gren` | `AgentCompleted` type change; `StartConfig` add `resumeSessionId` |
| `packages/chorus/src/Provider/ClaudeCode.gren` | Extract `session_id`, use `resumeSessionId`, omit `--system-prompt` on resume |
| `packages/chorus/src/Provider/OpenCode.gren` | Same as ClaudeCode; skip AGENTS.md write on resume |
| `packages/chorus/src/Main.gren` | `outputToolInstruction` hint; store session ID in `handleProviderEvent`; `resumeSessionId = Nothing` in `spawnAgent`; retry logic in `handlePlannerComplete` |

## Implementation order

1. Registry.gren + Main.gren `outputToolInstruction` (Fix 1 — standalone, no type ripple)
2. Provider.gren type changes (causes compile errors)
3. ClaudeCode.gren + OpenCode.gren (fix compile errors, add session_id extraction)
4. Main.gren `handleProviderEvent` + `spawnAgent` (fix remaining compile errors, store session ID)
5. Main.gren `handlePlannerComplete` retry logic

## Verification

1. `npm run build:all` — compiles cleanly
2. `npm run test` — passes
3. Manual: start Chorus, create a task, verify task-validator system prompt includes chorus-tools invocation format (`CHORUS_LOG_LEVEL=debug`)
4. Manual: if the agent exits without calling planner-output, verify a retry is attempted (check logs for retry warning) before the task fails
