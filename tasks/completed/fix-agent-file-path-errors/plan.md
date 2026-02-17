# Fix Agent Executor State Machine and File Path Issues

## Summary

Fix interrelated issues discovered during task execution by encoding executor lifecycle invariants in the type system. The core problem is that `ExecutorState` is a flat record that represents multiple lifecycle phases (spawning, active, active-with-handoff) with the same type, allowing tool calls to be routed to noop providers, orphan HTTP responses to leak via parallel Dicts, and stale tool requests to be silently executed against dead sessions. Additionally fix `file.list` returning inconsistent path formats.

## Background

During task `0d22067b-9f69-4c3a-8472-798bfd7e8c4e`, the editor agent failed to read `story.md`. The writer agent created `story.md` at the root of the allowed directory (`/Users/david/dev/chorus/dist/story.md`). When the editor agent used `file.list` with pattern `story.md`, it got back the absolute path `/Users/david/dev/chorus/dist/story.md`. The agent then tried `file.read` with path `dist/story.md` (extracting relative-looking segments from the absolute path), which was resolved as `/Users/david/dev/chorus/dist/dist/story.md` — a non-existent path.

## Issue 1: `ExecutorState` Is a Flat Record That Allows Illegal States

### Problem

`ExecutorState` (`Main.gren:103-113`) is a single record type used for two fundamentally different lifecycle phases:

1. **Spawning** (`resolveAndSpawnAgent`, line 553-563): A placeholder with `providerState = NoProviderState` and a noop provider where every function silently returns `{ state = s, cmd = Cmd.none }`. No agent process is running.

2. **Active** (`spawnAgent` / `GotProviderResolved`): A real provider, real provider state with pending HTTP responses, a running agent process.

Both are stored as the same type in `activeExecutors`. When a tool HTTP request arrives at `GotToolAgentLookup` (line 816), the code does `Dict.get taskIdStr model.activeExecutors`, finds `Just executor`, and routes the tool call to the noop provider — which silently discards it. The agent never gets a response and hangs until killed.

Additional type-level problems in the current record:
- `isSystemAgent : Bool` — determines completion handler dispatch, should be a union type
- `retryCount : Int` / `sessionId : Maybe String` — unused scaffolding, dead fields

### Current Type
```gren
type alias ExecutorState =
    { taskId : TaskId
    , agentName : String
    , agentConfig : Types.AgentConfig
    , executorModel : Executor.Model
    , providerState : Provider.ProviderState    -- can be NoProviderState
    , provider : Provider.Provider Msg          -- can be noop
    , isSystemAgent : Bool
    , retryCount : Int                          -- unused
    , sessionId : Maybe String                  -- unused
    }
```

### New Type
```gren
type ExecutorState
    = Spawning
        { taskId : TaskId
        , agentName : String
        , agentConfig : Types.AgentConfig
        , agentKind : AgentKind
        }
    | Active ActiveExecutor

type alias ActiveExecutor =
    { taskId : TaskId
    , agentName : String
    , agentConfig : Types.AgentConfig
    , agentKind : AgentKind
    , executorModel : Executor.Model
    , providerState : Provider.ProviderState
    , provider : Provider.Provider Msg
    }

type AgentKind
    = SystemAgent
    | UserAgent
```

### What This Eliminates

The tool routing in `GotToolAgentLookup` becomes:
```gren
when maybeExecutor is
    Nothing ->
        -- No executor — reject with error
        ...

    Just (Spawning _) ->
        -- Provider still resolving — reject, agent not ready yet
        ...

    Just (Active executor) ->
        -- Real provider, safe to route tool calls
        ...
```

It is **structurally impossible** to route a tool call to a noop provider. The `Spawning` variant has no provider to call. The `Active` variant is only constructed in `spawnAgent` / `GotProviderResolved` when a real provider exists.

### Files to Modify
- `packages/chorus/src/Main.gren` — `ExecutorState` type definition, `resolveAndSpawnAgent`, `spawnAgent`, `GotProviderResolved`, `GotToolAgentLookup`, `handleExecutorMsg`, `handleUserAgentComplete`, `handlePlannerComplete`, `handleProviderEvent`, all pattern matches on `ExecutorState`

## Issue 2: `pendingHandoffResponses` Is a Parallel Dict That Can Desync

### Problem

`Model` has two separate Dicts keyed by the same task ID string:
```gren
, activeExecutors : Dict String ExecutorState
, pendingHandoffResponses : Dict String Response
```

These must be kept in sync manually. An entry in `pendingHandoffResponses` without a corresponding executor is a leaked HTTP response handle. An executor without its handoff response means the parent agent never gets the handoff result. Cleanup in `handleUserAgentComplete` (line 3403-3404) removes from both Dicts separately — nothing in the types prevents them from going out of sync.

### Fix

Move the handoff response into the executor state by adding a variant:

```gren
type ExecutorState
    = Spawning SpawningFields
    | Active ActiveExecutor
    | ActiveHandoff ActiveExecutor Response
```

The `ActiveHandoff` variant carries the deferred HTTP response alongside the executor. When the executor is removed from `activeExecutors`, the response is atomically removed with it. This eliminates `pendingHandoffResponses` from `Model` entirely.

The dispatch code in `handleUserAgentComplete` becomes:
```gren
when executorState is
    ActiveHandoff executor deferredResponse ->
        -- Send response to parent agent, clean up executor
        ...

    Active executor ->
        -- Normal agent completion, no parent to notify
        ...

    Spawning _ ->
        -- Should not happen (agent didn't run yet)
        ...
```

No need to look up a separate Dict. The handoff response is guaranteed present exactly when the executor was spawned via handoff.

### Files to Modify
- `packages/chorus/src/Main.gren` — Remove `pendingHandoffResponses` from `Model`, add `ActiveHandoff` variant to `ExecutorState`, update `GotDeferredHandoffStarted`, `handleUserAgentComplete`, `handlePlannerComplete`

## Issue 3: `NoProviderState` Exists as a Valid Variant

### Problem

`ProviderState` (`Provider.gren:253-260`) has a `NoProviderState` variant that only exists to serve as a placeholder during the spawning phase:

```gren
type ProviderState
    = CliProviderState { pendingHttpResponses : Dict String HttpResponse.Response }
    | ApiProviderState { session : Maybe Session }
    | NoProviderState
```

With the current flat `ExecutorState`, both `NoProviderState` and `CliProviderState` appear in the same record, so `deliverToolResults` and `handleHttpToolCall` must handle `NoProviderState` with a no-op `_ ->` branch.

### Fix

Once `ExecutorState` is a union type (Issue 1), `Spawning` has no `providerState` field at all, and `Active` always has a real provider. `NoProviderState` can be removed.

If API providers need an initializing state (session not yet established), replace `ApiProviderState { session : Maybe Session }` with:

```gren
type ProviderState
    = CliProviderState { pendingHttpResponses : Dict String HttpResponse.Response }
    | ApiProviderState { session : Session }
```

The `Maybe Session` disappears because `Active` is only constructed after the session is established.

### Files to Modify
- `packages/chorus/src/Provider.gren` — Remove `NoProviderState` variant, remove `Maybe` from `ApiProviderState`
- `packages/chorus/src/Provider/ClaudeCode.gren` — Remove `_ ->` no-op branches in `deliverToolResults` and `handleHttpToolCall`
- `packages/chorus/src/Provider/OpenCode.gren` — Same
- `packages/chorus/src/Provider/OpenAiCompat.gren` — Update `ApiProviderState` usage

## Issue 4: No-Executor Fallback Silently Executes Tools Against Dead Sessions

### Problem

In `GotToolAgentLookup` (`Main.gren:820-842`), when no executor is found, the code falls through to direct tool execution via `ToolExecution.requestExecuteTool`. This path executes the tool, logs a `tool_executed` event, and sends the result back to the caller — even though no agent is alive to receive it.

This produced the orphaned `tool_executed` event 53 minutes after the agent died:
```
1771229486029  agent_handoff_completed  (handoff #6 — editor fails)
1771232684708  tool_executed            (file.read dist/story.md — orphan from dead session)
```

### Fix

With the `ExecutorState` union type, this becomes an explicit rejection rather than a silent fallback:

```gren
when maybeExecutor is
    Nothing ->
        { model = model
        , command =
            Cmd.batch
                [ sendBadRequest response "No active agent session for this task"
                , Logging.logWarn model.logger
                    ("Tool request rejected for task " ++ taskIdStr ++ ": no active executor")
                    NoOp
                ]
        }

    Just (Spawning _) ->
        { model = model
        , command = sendBadRequest response "Agent is still starting"
        }

    Just (Active executor) ->
        -- route through provider
        ...

    Just (ActiveHandoff executor _) ->
        -- route through provider (same as Active)
        ...
```

No tool execution, no event logging, no misleading history entries.

### Files to Modify
- `packages/chorus/src/Main.gren` — `GotToolAgentLookup` handler (lines 819-926), remove the no-executor fallback, replace with rejection. Also remove the `GotToolResult` handler's tool execution path (lines 1310-1370) which is only reachable from the fallback.

## Issue 5: `ToolResult` Lacks `toolName`, Events Log Call ID Instead

### Problem

In `Main.gren` line 2721, the Executor-path tool event logging uses `toolResult.toolCallId` for the "tool" field. The `ToolResult` type (`Provider.gren`) only has `{ toolCallId, output, isError }` — no tool name. Events logged through this path show IDs like `"0d22067b-...-file.read-0"` instead of `"file.read"`.

### Fix

Add `toolName : String` to the `ToolResult` type:

```gren
type alias ToolResult =
    { toolCallId : String
    , toolName : String
    , output : String
    , isError : Bool
    }
```

Populate it from `toolCallResult.toolName` in `Executor.handleToolCallCompleted` (line 337-341), and use it in the event logging at `Main.gren:2721`:

```gren
|> Dict.set "tool" toolResult.toolName
```

### Files to Modify
- `packages/chorus/src/Provider.gren` — Add `toolName` to `ToolResult` type alias
- `packages/chorus/src/Agent/Executor.gren` — Populate `toolName` in `collectResultAndCheckBatch`
- `packages/chorus/src/Main.gren` — Use `toolResult.toolName` in event logging (line 2721)

## Issue 6: `file.list` with Pattern Returns Absolute Paths

### Problem

In `packages/tools/src/Tools/File.gren`, `listWithPattern` (line 680) uses the `find` command which returns absolute paths. `listDirectorySimple` (line 639) uses `FileSystem.listDirectory` which returns relative paths. Agents get different path formats depending on whether they use `file.list` with or without a pattern.

During the task, `file.list` with pattern `story.md` returned `/Users/david/dev/chorus/dist/story.md`. The agent extracted `dist/story.md` as a relative path, which resolved as `/Users/david/dev/chorus/dist/dist/story.md` — double-prefixed.

### Fix

In `listWithPattern`, strip the search directory prefix from `find` output paths so they are relative to the allowed directory root, consistent with `listDirectorySimple`.

### Files to Modify
- `packages/tools/src/Tools/File.gren` — `listWithPattern` (around line 720-730), strip search path prefix from results

## Issue 7: `bash -c` Doesn't Kill Child Process Trees

### Problem

The agent is spawned via `ChildProcess.run "bash" ["-c", shellCommand]` (`ClaudeCode.gren:121`). When the 10-minute `runDuration` timeout fires, the Gren ChildProcess runtime kills `bash`, but the actual claude CLI and its chorus-tools/curl subprocesses survive as orphans. Evidence: the agent ran for 17 minutes (exceeding the 10-min timeout), and an orphaned curl request arrived 53 minutes after the agent was reported dead.

The error message `"Agent CLI exited with code null: "` comes from the Gren/JS interop layer coercing a signal-killed process's null exit code before it reaches the `ProgramError` handler.

### Fix

1. Use `exec` in the shell command so bash replaces itself with the child process: `bash -c "exec claude ..."`. This ensures the timeout kills the actual agent process directly.

2. In `ClaudeCode.gren` and `OpenCode.gren`, when stderr is empty, include the tail of stdout in the error message. Detect signal kills and report explicitly.

### Files to Modify
- `packages/chorus/src/Provider/ClaudeCode.gren` — `buildShellCommand` (add `exec`), error handler (lines 148-166)
- `packages/chorus/src/Provider/OpenCode.gren` — equivalent changes

## Acceptance Criteria

- [ ] `ExecutorState` is a union type (`Spawning | Active | ActiveHandoff`) — tool calls cannot be routed to a spawning executor
- [ ] `pendingHandoffResponses` is removed from `Model` — handoff response lives inside `ActiveHandoff` variant
- [ ] `NoProviderState` is removed — `Active` always has a real `ProviderState`
- [ ] Tool requests arriving when no executor exists (or executor is `Spawning`) are rejected with an error, not silently executed
- [ ] `ToolResult` carries `toolName` — `tool_executed` events show the tool name, not the call ID
- [ ] `file.list` with pattern returns paths relative to the allowed directory
- [ ] Agent process timeout reliably kills the entire process tree (no orphan processes via `exec`)
- [ ] Agent failure messages include useful context instead of "exited with code null"

## Out of Scope

- Changing how agents decide which paths to use (agent prompt/behavior issue)
- Modifying the `Path.append` argument order (working correctly per the Gren API)
- Changing the handoff protocol or agent context passing
- Refactoring `Executor.Model` — the `Maybe CompletionReport` / `Maybe PlannerOutput` fields are semantically correct (agents may not submit these)

## Implementation Order

1. **Type changes first** (Issues 1-4): Change `ExecutorState` to a union type, merge `pendingHandoffResponses` into it, remove `NoProviderState`. This is the largest change and touches the most files. The compiler will guide all the pattern match updates.
2. **`ToolResult.toolName`** (Issue 5): Small additive change.
3. **`file.list` path normalization** (Issue 6): Isolated to the tools package.
4. **`bash -c` exec fix** (Issue 7): One-line change in `buildShellCommand`, plus error message improvement.

## Testing Requirements

- Build: `npm run build:all` must succeed
- Test: `npm run test` must pass
- Manual verification: Create a workspace, start a task, verify tool calls route correctly through handoffs
- Manual verification: Kill an agent process during execution, verify clean process termination and informative error message
- Manual verification: Use `file.list` with a pattern, verify returned paths are relative

## Notes

- The `Path.append` function in Gren has unusual argument order: `Path.append child parent` appends `child` onto `parent`. The current usage in `Validation.gren` line 107 (`Path.append relativePath firstDir`) is correct.
- The root cause of the agent using the wrong path is the inconsistent path format from `file.list`, not a bug in path resolution.
- The 17-minute agent runtime (vs 10-minute timeout) is direct evidence that `bash -c` didn't propagate the kill.
- The orphaned curl request arriving 53 minutes later is direct evidence that chorus-tools survived the agent kill.
- The type refactor (Issues 1-4) is the highest-value change — it makes the tool-call-to-noop-provider bug, the orphaned-event bug, and the leaked-handoff-response bug all structurally impossible.
