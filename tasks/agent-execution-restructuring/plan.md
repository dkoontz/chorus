# Provider Interface Unification

## Context

Main.gren bypasses the existing Provider interface (`Provider.gren`) and Executor (`Agent/Executor.gren`) entirely. Agent spawning goes through `buildShellCommandForProvider` → `ChildProcess.run "bash"` directly, duplicated across `buildAgentSpawn` and `dispatchPlanner`. API providers (OpenAI-compatible) cannot execute agents at all — `buildShellCommandForProvider` returns `Err` for them.

The goal is to create a unified Provider interface (record of functions) that all providers implement, with the Executor seeing no difference between provider types.

**Key design decisions:**
- **Unified tool execution:** The Executor owns tool execution for ALL providers. Whether a tool call arrives from a `chorus-tools` HTTP callback (CLI agents) or from an LLM API response (API agents), it flows through the same Executor path: permission check → execute → return result to Provider → Provider delivers to agent.
- **Provider resolution for CLI tool calls:** When a `chorus-tools` HTTP request arrives, Main.gren resolves the agent → looks up its Provider → passes the tool call through the Provider (which may do provider-specific handling) → Provider delegates to Executor.
- **Shared tool execution functions:** `Web.ToolExecution` functions are called by the Executor regardless of tool call origin. No duplication.

## Tool call flow (unified)

```
Tool Call Source                         Provider                    Executor
─────────────────                       ─────────                   ─────────
CLI: chorus-tools HTTP request    ──→   Provider receives call  ──→  1. Check permission
API: LLM response tool_calls     ──→   (may pre-process)       ──→  2. Execute via ToolExecution
                                                                     3. Return result to Provider
                                        Provider delivers result ←──
CLI: sends HTTP response to chorus-tools  ←──┘
API: calls submitToolResults to LLM API   ←──┘
```

The Executor doesn't know where tool calls come from or how results are delivered. It just processes them.

## Phase 1: Redesign Provider interface

**Goal:** Define the Provider interface that both CLI and API providers implement.

### `packages/chorus/src/Provider.gren`

The existing interface has `createSession`, `sendMessage`, `submitToolResults`, `resumeSession`. This needs to be rethought because the Executor should drive tool execution uniformly. The Provider's role is:

1. **Start a conversation** — spawn CLI or send first message to API
2. **Receive tool calls** — from HTTP callbacks (CLI) or API responses (API)
3. **Deliver tool results to the agent** — HTTP response (CLI) or submitToolResults (API)
4. **Signal completion** — CLI process exit or API `isComplete = True`

New interface:

```gren
type alias Provider msg =
    { kind : ProviderKind
    , validateEnvironment : (Result ProviderError {} -> msg) -> Cmd msg
    , startAgent : ProviderState -> StartConfig msg -> { state : ProviderState, cmd : Cmd msg }
    , deliverToolResults : ProviderState -> Array ToolResult -> { state : ProviderState, cmd : Cmd msg }
    , handleHttpToolCall : ProviderState -> HttpToolCallContext -> { state : ProviderState, cmd : Cmd msg }
    , initState : ProviderState
    }

type alias StartConfig msg =
    { agentSpec : AgentSpec
    , message : String
    , workspaceRoot : String
    , onEvent : ProviderEvent -> msg
    }

type ProviderEvent
    = ToolCallReceived ToolCall
    | AgentCompleted String
    | AgentFailed String
```

- `startAgent`: Begins the conversation. Takes and returns `ProviderState`. CLI providers spawn the process; API providers send the first message. Events arrive asynchronously via `onEvent`.
- `ToolCallReceived`: A tool call has arrived (from HTTP callback for CLI, from API response for API).
- `deliverToolResults`: Sends processed tool results back to the agent. Takes and returns `ProviderState`. CLI providers send HTTP responses (using response handles stored in state). API providers call the LLM API with accumulated results.
- `handleHttpToolCall`: Receives a chorus-tools HTTP callback, stores the HTTP response handle in state, and emits a `ToolCallReceived` event. Only meaningful for CLI providers; API providers can no-op.
- `AgentCompleted`/`AgentFailed`: Conversation finished.

**For CLI providers:**
- `startAgent` spawns the CLI process. When the process exits, emits `AgentCompleted`.
- Tool calls arrive via Main.gren routing HTTP callbacks to the Provider. The Provider wraps them as `ToolCallReceived` events.
- `deliverToolResults` sends the HTTP response back to chorus-tools.

**For API providers:**
- `startAgent` sends the first message to the LLM API. If the response has tool calls, emits `ToolCallReceived` for each. If complete, emits `AgentCompleted`.
- `deliverToolResults` calls `submitToolResults` on the LLM API. If the next response has more tool calls, emits more events.

### Provider state management

Providers need to track state (pending HTTP responses for CLI, session + conversation history for API). Provider state is stored as an opaque `ProviderState` type on the `ExecutorState` in Main.gren, threaded through Provider function calls:

```gren
type alias Provider msg =
    { kind : ProviderKind
    , validateEnvironment : (Result ProviderError {} -> msg) -> Cmd msg
    , startAgent : ProviderState -> StartConfig msg -> { state : ProviderState, cmd : Cmd msg }
    , deliverToolResults : ProviderState -> Array ToolResult -> { state : ProviderState, cmd : Cmd msg }
    , handleHttpToolCall : ProviderState -> HttpToolCallContext -> { state : ProviderState, cmd : Cmd msg }
    , initState : ProviderState
    }
```

Each provider module defines its own concrete state behind the opaque `ProviderState` type. CLI provider state holds pending HTTP responses. API provider state holds session + conversation history. The `initState` field provides the initial state when creating a new executor.

## Phase 2: Extract shared tool execution

**Goal:** Make `Web.ToolExecution` callable from the Executor's tool processing pipeline.

### `packages/chorus/src/Web/ToolExecution.gren`

Add new exported function and type:

```gren
type alias ToolCallResult =
    { toolCallId : String
    , toolName : String
    , requestBody : String
    , result : ApiResult
    }

executeToolCall :
    ToolExecutionContext
    -> { id : String, name : String, input : Json.Decode.Value }
    -> (ToolCallResult -> msg)
    -> Cmd msg
```

Implementation:
1. Encode the tool call as JSON string: `{"tool": name, ...input_fields}`
2. Check permission (same as `requestExecuteTool`)
3. Call existing `dispatchTool` with the JSON string
4. Wrap result in `ToolCallResult` with the `id`, `name`, and `requestBody` for correlation

The existing `requestExecuteTool` (HTTP path) stays for now but is eventually replaced by routing HTTP tool calls through the Provider → Executor → `executeToolCall` path.

## Phase 3: Refactor Agent.Executor

**Goal:** Make `Agent.Executor` the unified execution engine that processes tool calls identically regardless of source.

### `packages/chorus/src/Agent/Executor.gren`

**Config:**
```gren
type alias Config msg =
    { executeTool :
        { id : String, name : String, input : Json.Decode.Value }
        -> (ToolCallResult -> msg)
        -> Cmd msg
    , toMsg : Msg -> msg
    }
```

The Executor receives tool calls via messages and processes them via `config.executeTool`. It doesn't know about Providers.

**Msg:**
```gren
type Msg
    = ToolCallReceived { id : String, name : String, input : Json.Decode.Value }
    | ToolCallCompleted ToolCallResult
    | AgentCompleted String
    | AgentFailed String
```

The Executor receives events from the Provider (via Main.gren routing) and processes them:

- `ToolCallReceived`: Execute the tool via `config.executeTool`. Transitions to processing state.
- `ToolCallCompleted`: Tool result ready.
  - If result is `DeferredHandoff` or `DeferredPlannerOutput`: surface as a special state for Main.gren to handle
  - If regular result: signal Provider to deliver result. If all pending tools done, Provider delivers batch.
  - If `completion-report` success: store on executor state
- `AgentCompleted`: Conversation finished.
- `AgentFailed`: Agent errored.

**Model:**
```gren
type Model
    = Idle
    | Running
        { pendingToolCalls : Dict String PendingTool
        , completionReport : Maybe CompletionReport
        , plannerOutput : Maybe PlannerOutput
        }
    | AwaitingDeferredAction DeferredAction
    | Complete { output : String }
    | Failed { error : String }
```

The Executor is a pure tool-processing state machine. It doesn't manage Provider communication — the Provider feeds events in, the Executor processes them, and signals what to do next.

## Phase 4: Wire everything into Main.gren

**Goal:** Replace `buildAgentSpawn`/`dispatchPlanner` with the unified Provider → Executor path. Route CLI tool callbacks through the Provider.

### `packages/chorus/src/Main.gren`

**New Msg variants:**
```gren
| ExecutorMsg { taskId : TaskId, msg : Agent.Executor.Msg }
| ProviderEvent { taskId : TaskId, event : Provider.ProviderEvent }
```

**ExecutorState changes:**
```gren
type alias ExecutorState =
    { taskId : TaskId
    , agentName : String
    , agentConfig : Types.AgentConfig
    , executorModel : Agent.Executor.Model
    , providerState : Provider.ProviderState
    , provider : Provider.Provider Msg
    , isSystemAgent : Bool
    , retryCount : Int
    , sessionId : Maybe String
    }
```

`completionReport` and `plannerOutput` move into `Agent.Executor.Model` since the Executor now tracks them.

**Unified agent spawning (`spawnAgent`):**
```gren
spawnAgent :
    Model
    -> TaskId
    -> String
    -> Types.AgentConfig
    -> Bool  -- isSystemAgent
    -> { executorState : ExecutorState, spawnCmd : Cmd Msg }
```

1. Call `makeProvider` to create Provider instance
2. Build system prompt (agent instructions + tool context + output tool instruction)
3. Initialize Executor model and Provider state
4. Call `provider.startAgent` with the message
5. Return executor state + spawn command

**Handle `ProviderEvent`:**
```gren
ProviderEvent { taskId, event } ->
    when event is
        Provider.ToolCallReceived toolCall responseHandle ->
            -- Forward to Executor for processing
            -- Executor will call executeTool (via ToolExecution)
            -- When result ready, call provider.deliverToolResults

        Provider.AgentCompleted output ->
            -- Forward to Executor as AgentCompleted
            -- Executor transitions to Complete
            -- Main.gren delegates to handlePlannerComplete/handleUserAgentComplete

        Provider.AgentFailed error ->
            -- Similar to AgentCompleted but with error
```

**Route CLI tool callbacks through Provider:**

Change `GotToolAgentLookup` handler:
1. Look up executor from `activeExecutors` (already does this)
2. Instead of calling `ToolExecution.requestExecuteTool` directly, route through the Provider:
   ```gren
   provider.handleHttpToolCall providerState { toolCall, httpResponse }
   ```
3. Provider wraps as `ToolCallReceived` event → Executor processes → result delivered via Provider

This replaces the current `GotToolAgentLookup` → `ToolExecution.requestExecuteTool` → `GotToolResult` path.

**Delete:**
- `buildAgentSpawn`
- `buildShellCommandForProvider`
- `dispatchPlanner` (unified into `spawnAgent` with `isSystemAgent = True`)
- `GotAgentComplete` (replaced by `ProviderEvent AgentCompleted`)
- `GotPlannerComplete` (merged into `ProviderEvent AgentCompleted` path)
- Direct tool result handling in `GotToolResult` for executor-managed agents (moved into Executor)

## Phase 5: Unify planner spawning

**Goal:** Planners use the same `spawnAgent` path as user agents.

Replace `dispatchPlanner` with:
1. Look up `task-validator` agent config
2. Set task status to Planning, record PlanningStarted event, set currentAgent
3. Call `spawnAgent` with `isSystemAgent = True`

The planner-output vs completion-report instruction difference is handled by `spawnAgent` checking the `isSystemAgent` flag.

## Phase 6: Enable API provider execution

**Goal:** API providers can execute agents through the unified path.

### `packages/chorus/src/Provider/OpenAiCompatible.gren`

Implement the new Provider interface:
- `startAgent`: Send first message to LLM API, emit `ToolCallReceived` events for tool calls, `AgentCompleted` when done
- `deliverToolResults`: Call submitToolResults on LLM API, emit events for next response
- `handleHttpToolCall`: Not applicable for API providers (tool calls come from API responses, not HTTP)

Add tool definitions to chat completion requests so the LLM knows what tools are available.

### `packages/chorus/src/Provider/ClaudeCode.gren` and `OpenCode.gren`

Implement the new Provider interface:
- `startAgent`: Spawn CLI process. On exit, emit `AgentCompleted`/`AgentFailed`.
- `deliverToolResults`: Send HTTP response to the pending chorus-tools request (using stored ResponseHandle).
- `handleHttpToolCall`: Receive chorus-tools HTTP callback, emit `ToolCallReceived` event.

## Files changed

| File | Changes |
|------|---------|
| `Provider.gren` | New interface: `startAgent`, `deliverToolResults`, `ProviderEvent`, `ProviderState` |
| `Provider/ClaudeCode.gren` | Implement new interface (replaces `buildShellCommand` public API) |
| `Provider/OpenCode.gren` | Implement new interface |
| `Provider/OpenAiCompatible.gren` | Implement new interface, add tool definitions to API requests |
| `Web/ToolExecution.gren` | Add `executeToolCall`, `ToolCallResult` type |
| `Agent/Executor.gren` | Rewrite as tool-processing state machine (receives events, processes tool calls) |
| `Main.gren` | Add `ExecutorMsg`/`ProviderEvent` msgs, add `spawnAgent`, route HTTP tool callbacks through Provider, delete `buildAgentSpawn`/`buildShellCommandForProvider`/`dispatchPlanner` |
| `Agent/Manager.gren` | No changes — pure decision functions still used by Main.gren |

## Verification

1. **Build:** `npm run build:all` — must compile cleanly after each phase
2. **Unit test:** `npm run test`
3. **CLI providers end-to-end:** Create a task, verify planner runs (tool calls go through Executor), agent executes (chorus-tools calls routed through Provider → Executor), completion-report stored, handoff works
4. **API providers end-to-end (Phase 6):** Configure OpenAI-compatible provider, create a task, verify conversation loop with tool calls works
5. **Regression:** All existing functionality preserved — just routed through the unified path
