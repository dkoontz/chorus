# Provider vs Agent Manager: Architecture Separation

This document maps out how provider transport and agent business logic are currently interleaved in the codebase, and what belongs where when separated into the new `Agent.Manager` module.

## Current Architecture

All agent lifecycle logic lives in `Main.gren`. There is no dedicated module for agent business decisions. The `Provider` interface and its implementations (`ClaudeCode`, `OpenAiCompatible`, `OpenCode`) handle transport only, but Main.gren mixes transport orchestration with business logic in every `Msg` handler.

### What "Provider" means today

The `Provider` module (`packages/chorus/src/Provider.gren`) defines a polymorphic interface:

```
type alias Provider msg =
    { kind : ProviderKind          -- CliProvider | ApiProvider
    , validateEnvironment : ...
    , createSession : ...
    , sendMessage : ...
    , submitToolResults : ...
    , resumeSession : ...
    }
```

Three implementations exist:
- **`Provider.ClaudeCode`** - Spawns `claude` CLI with `--output-format json`. Tools are handled internally by the CLI. The key function is `buildShellCommand` which assembles CLI flags including `--system-prompt`, `--resume`, `--tools`, `--allowedTools`, and environment variables (`CHORUS_TASK_ID`, `CHORUS_BASE_URL`).
- **`Provider.OpenCode`** - Spawns `opencode` CLI. Similar pattern to ClaudeCode but writes system prompts to AGENTS.md files instead of CLI flags.
- **`Provider.OpenAiCompatible`** - HTTP-based. Manages conversation history in files. Supports tool calls via the OpenAI Chat Completions API format.

**Important**: The `Provider` interface is currently only used by `makeProvider` in Main.gren (line 322), and `makeProvider` itself is currently unused in the codebase. Agent spawning goes through `buildAgentSpawn` and `buildShellCommandForProvider` instead, which call provider-specific functions directly (e.g. `ClaudeCode.buildShellCommand`). The `Provider` interface exists but isn't the active execution path.

### What "Agent Management" means today

Agent management is all the logic that decides:
1. **What to do when an agent finishes** - Check completion report, update task status, resolve deferred handoff responses, record history events
2. **What to do when a planner finishes** - Parse output, apply plan or set questions or fail
3. **Whether to retry** - Currently no retry logic exists
4. **How to track running agents** - The `activeExecutors : Dict String ExecutorState` in Model
5. **Exactly-once enforcement** - Currently only a boolean flag (`completionReportReceived`) on ExecutorState

All of this lives directly in `Main.gren` message handlers, mixed with `Cmd` construction, registry calls, and response sending.

## Where Each Concern Lives Today

### ExecutorState (Main.gren:93-99)

```gren
type alias ExecutorState =
    { taskId : TaskId
    , agentName : String
    , agentConfig : Types.AgentConfig
    , status : ExecutorStatus
    , completionReportReceived : Bool
    }
```

This tracks a running user agent. **Planners are NOT tracked here.** The planner is spawned as a fire-and-forget `ChildProcess.run` in `dispatchPlanner` (line 2587) and its result arrives via `GotPlannerComplete` - completely separate from `GotAgentComplete`.

### Agent spawn path (user agents)

1. **Entry**: `handleRoute` receives `Router.StartHandoff` or a deferred handoff from tool execution
2. **Agent lookup**: `GotAgentLookup` / `GotDeferredHandoffLookup` - finds agent config in AgentRegistry
3. **Task update**: `GotHandoffRecorded` / `GotDeferredHandoffStarted` - records the handoff in the task registry
4. **Spawn**: `buildAgentSpawn` (line 486) constructs `ExecutorState` and `Cmd` to run the CLI
5. **Completion**: `GotAgentComplete` (line 974) - processes the result

`buildAgentSpawn` is where transport and business logic merge:
- **Business logic**: Constructs system prompt by combining agent instructions + tool context + completion-report instruction. Creates the `ExecutorState`.
- **Transport**: Resolves provider config, builds shell command, spawns `ChildProcess.run`.

### Planner spawn path (system agent)

1. **Entry**: `GotPlanTaskResult` (line 1350) or `GotAnswersSubmitted` (line 1478) calls `dispatchPlanner`
2. **Spawn**: `dispatchPlanner` (line 2587) does everything inline:
   - Checks workspace config and system agent provider
   - Looks up `task-validator` agent config
   - Sets task status to Planning, records PlanningStarted event
   - Resolves provider config
   - Builds shell command via `buildShellCommandForProvider`
   - Spawns `ChildProcess.run`
   - On completion: unwraps batch JSON to extract `result` text
3. **Completion**: `GotPlannerComplete` (line 1378) processes the result:
   - Calls `parsePlannerOutput` which uses `extractJsonCodeFence` (fragile!)
   - On success: `Api.requestApplyPlan` or `Api.requestSetQuestions`
   - On failure: `Api.requestUpdateStatus` to Failed

**Key problem**: The planner does NOT register in `activeExecutors`, does NOT set `currentAgent` on the task, and therefore the tool execution endpoint (`Router.ExecuteTool`) fails with "No agent currently active on this task" (line 1918) if the planner tries to call tools.

### GotAgentComplete (line 974) - the big handler

This is where the most business logic is tangled with transport:

1. Looks up `hadCompletionReport` from executor state (boolean flag)
2. Checks for pending deferred handoff response
3. Chooses `requestCompleteAgent` vs `requestCompleteHandoff` based on whether there's a deferred response
4. Removes executor from `activeExecutors`
5. Builds deferred response body if needed
6. **Branch A** (had completion report): Just complete the handoff record timestamps
7. **Branch B** (no completion report, success): Complete with raw output, log warning
8. **Branch C** (no completion report, error): Complete with error, log error

The decision logic (branches A/B/C) is pure business logic that doesn't need access to Model, registries, or Cmd. It just needs: `exitResult`, `hadCompletionReport`, and returns a decision about what to do.

### GotPlannerComplete (line 1378) - separate handler

Parallel structure to GotAgentComplete but for planners:

1. Calls `parsePlannerOutput` on raw stdout text
2. **PlanResult**: Apply plan via `Api.requestApplyPlan`
3. **QuestionsResult**: Set questions via `Api.requestSetQuestions`
4. **PlannerParseError**: Fail task via `Api.requestUpdateStatus`
5. **Err**: Fail task (planner process error)

### Tool execution path

When an agent calls a tool via `chorus-tools`:

1. `Router.ExecuteTool taskId` -> looks up task, finds `currentAgent`, looks up agent config
2. `GotToolAgentLookup` -> builds `ToolExecutionContext` with the agent's `allowedTools` from **executor state** (not the persisted config - the executor may have been granted additional tools via `GotToolGrant`)
3. `ToolExecution.requestExecuteTool` dispatches to the correct handler
4. `GotToolResult` -> sends response back to the tool binary

For `completion-report`: auto-granted (line 99 of ToolExecution.gren), updates task status/chain in the registry, sets `completionReportReceived = True` on executor state.

For `handoff`: returns `DeferredHandoff` which GotToolResult intercepts to start a child agent.

### Completion report tracking

Currently tracked as `completionReportReceived : Bool` on ExecutorState. When `GotToolResult` sees a successful `completion-report`, it flips the flag (line 1294-1307). When `GotAgentComplete` fires, it checks this flag to decide whether to set task status or leave it (since the completion report already set it).

**Problem**: The boolean flag means we lose the report data. The actual `CompletionReport` is written to the task's handoff record in the registry by `dispatchCompletionReport` (ToolExecution.gren:271), but the executor state doesn't have it. The plan changes this to `Maybe CompletionReport`.

## What Belongs in Agent.Manager

The new `Agent.Manager` module should contain **pure functions** that take typed data and return decisions. Zero imports of Provider, ChildProcess, HttpClient, FileSystem, Registry, or any IO module.

### processPlannerCompletion

**Input**: Exit result + Maybe PlannerOutput (from executor state)
**Output**: One of: PlanReady, QuestionsReady, PlannerExitError, PlannerOutputMissing

Currently scattered across:
- `GotPlannerComplete` handler (Main.gren:1378-1476)
- `parsePlannerOutput` (Main.gren:2722-2757)
- `extractJsonCodeFence` (Main.gren:2762-2794)

After the refactor, the tool-based output means the `PlannerOutput` is already parsed and stored on the executor state before the process exits. The Manager function just checks: is it there? What type? Did the process exit cleanly?

### processAgentCompletion

**Input**: Exit result + Maybe CompletionReport (from executor state)
**Output**: One of: CompletedWithReport, CompletedWithoutReport, AgentExitError

Currently scattered across `GotAgentComplete` handler (Main.gren:974-1137). The branching logic (had report vs not, success vs error) is business logic that can be extracted.

### shouldRetry

**Input**: RetryContext { retryCount, maxRetries }
**Output**: Bool

New logic. Called when an agent exits without submitting its required output tool. Pure arithmetic check.

### What stays in Main.gren

Main.gren keeps all the "wiring" - the parts that need Model, Cmd, registry access, provider resolution, process spawning:

- `buildAgentSpawn` - needs Model for provider resolution, ChildProcess permission, config paths
- `dispatchPlanner` - needs Model, AgentRegistry, ProviderRegistry, ChildProcess
- `GotAgentComplete` handler - uses Manager decisions but still constructs Cmds (registry updates, API calls, deferred response sending, logging)
- `GotToolResult` handler - stores data on executor state, sends HTTP responses
- `handleRoute` - HTTP routing, permission checks

## The Planner/Executor Unification

The biggest structural change is tracking planners in `activeExecutors`:

### Before (current)

```
User agent:  GotHandoffRecorded -> buildAgentSpawn -> activeExecutors -> GotAgentComplete
Planner:     GotPlanTaskResult -> dispatchPlanner -> (fire and forget) -> GotPlannerComplete
```

Two completely separate paths. The planner doesn't set `currentAgent` on the task, doesn't register in `activeExecutors`, and can't call tools.

### After (planned)

```
User agent:  GotHandoffRecorded -> buildAgentSpawn -> activeExecutors -> GotAgentComplete
Planner:     GotPlanTaskResult -> dispatchPlanner -> activeExecutors -> GotAgentComplete
```

Both go through `activeExecutors`. The executor state gains `isSystemAgent : Bool` to distinguish them. `GotAgentComplete` checks this flag and delegates to the appropriate Manager function.

The `dispatchPlanner` refactoring:
1. Sets `currentAgent = "task-validator"` on the task (enables tool execution)
2. Creates an `ExecutorState` with `isSystemAgent = True`
3. Registers it in `activeExecutors`
4. Spawns the CLI process to emit `GotAgentComplete` (not `GotPlannerComplete`)
5. Extracts and stores `session_id` for retry

## DeferredPlannerOutput Pattern

Following the existing `DeferredHandoff` pattern in `Api.ApiResult`:

```gren
type ApiResult
    = ApiSuccess { statusCode : Int, body : String }
    | ApiError { statusCode : Int, code : String, message : String }
    | DeferredHandoff { agentName : String, prompt : String }
    | DeferredPlannerOutput PlannerOutput        -- NEW
```

When the planner calls the `planner-output` tool:
1. `ToolExecution.dispatchPlannerOutput` decodes the request body
2. Returns `DeferredPlannerOutput` (doesn't apply the plan yet)
3. `GotToolResult` in Main.gren intercepts `DeferredPlannerOutput`:
   - Checks exactly-once: if `plannerOutput` is already `Just` on executor, return error
   - Stores `PlannerOutput` on executor state
   - Sends success response to agent
   - Records `PlannerOutputSubmitted` event

The plan is NOT applied until the process exits (`GotAgentComplete`), ensuring the planner can finish its work cleanly.

## Session ID and Retry

For retry to work, we need the CLI session ID to pass `--resume`:

1. **First run**: CLI outputs batch JSON with `session_id` field. After process exits, extract from stdout.
2. **Store**: On executor state as `sessionId : Maybe String`
3. **Retry**: Build new command with `--resume <sessionId>` and a nudge message telling the agent to call the required tool.

The retry loop:
```
Process exits -> GotAgentComplete -> check required tool submitted?
  Yes -> process normally (apply plan / use completion report)
  No  -> shouldRetry?
    Yes -> increment retryCount, keep in activeExecutors, spawn --resume
    No  -> fail task with "agent did not submit required output"
```

Max retries: 2 (configurable in Manager as a constant).

## File-by-File Change Summary

| File | Current role | Changes |
|------|-------------|---------|
| `Types.gren` | Shared types | Add `PlannerOutput` type, `PlannerOutputSubmitted` EventType |
| `Agent/Manager.gren` | Does not exist | New module: `processAgentCompletion`, `processPlannerCompletion`, `shouldRetry` |
| `Web/ToolExecution.gren` | Tool dispatch + permission | Add `planner-output` handler, auto-grant it |
| `Web/Api.gren` | API handlers + result types | Add `DeferredPlannerOutput` variant, handle in `sendApiResponse` |
| `Main.gren` | Everything | Extend ExecutorState, unify planner path, delegate decisions to Manager |
| `Agent/ToolContext.gren` | System prompt tool docs | Add planner-output tool description |
| `Tools/Help.gren` | Tool help records | Add planner-output help entry |
| task-validator config | Agent instructions | Reference `planner-output` tool instead of code fences |

## Boundary Rules

The separation follows one rule: **Agent.Manager never constructs a Cmd.**

- It receives typed data (exit results, Maybe values, retry counts)
- It returns typed decisions (sum types describing what to do)
- Main.gren pattern-matches on those decisions and constructs the actual Cmds (registry writes, API calls, process spawns, HTTP responses, logging)

This makes the business logic testable without IO mocks - you can unit test `processPlannerCompletion` with various inputs and assert on the returned variant.
