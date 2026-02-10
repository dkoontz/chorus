# Implementation Plan

Detailed implementation plan for evolving Chorus from the current state to the desired architecture described in `architecture-analysis.md`.

## Task Overview

### High Priority (Core Flow)
1. [Server-side Tool Execution](#task-1-server-side-tool-execution) - Move tool logic into Chorus server
2. [Mandatory Completion-Report Tool](#task-2-mandatory-completion-report-tool) - Structured agent output
3. [Planning Agent Integration](#task-3-planning-agent-integration) - Auto-dispatch on task creation
4. [Agent-Driven Task Dispatch](#task-4-agent-driven-task-dispatch) - Start button spawns identified agent
5. [Task Status Refinements](#task-5-task-status-refinements) - New states for planning flow

### Medium Priority (Multi-Backend)
6. [HTTP Client via Node Ports](#task-6-http-client-via-node-ports) - Outbound HTTP for API providers
7. [Provider Generalization](#task-7-provider-generalization) - Support CLI and API execution models
8. [API Provider Implementation](#task-8-api-provider-implementation) - OpenRouter or Ollama provider
9. [Agent Backend Configuration](#task-9-agent-backend-configuration) - Provider/model fields on agent config

### Lower Priority (Polish)
10. [Question/Answer UI](#task-10-questionanswer-ui) - Planning questions display
11. [OpenCode Provider](#task-11-opencode-provider) - Second CLI provider
12. [Dynamic Tool Grants](#task-12-dynamic-tool-grants) - Runtime tool permission changes

## Dependency Graph

```
Task 5 (Status) ─────────────────────┐
    │                                 │
    ├──> Task 4 (Dispatch) ──> Task 9 (Backend Config)
    │                                 │
    └──> Task 10 (Q&A UI)            │
                                      v
Task 1 (Server Tools) ──> Task 2 (Completion Report) ──> Task 3 (Planning Agent)

Task 6 (HTTP Client) ──> Task 7 (Provider Gen) ──> Task 8 (API Provider)
                              │                         │
                              └──> Task 11 (OpenCode)   │
                                                        │
Task 12 (Dynamic Tools) ─── independent ────────────────┘
```

**Recommended implementation order:**
1. Task 5 (foundational - new statuses)
2. Task 1 (server-side tools - large, core infrastructure)
3. Task 2 (completion-report - depends on Task 1)
4. Task 4 (agent dispatch - depends on Task 5)
5. Task 9 (backend config - small, enables later work)
6. Task 3 (planning agent - depends on Tasks 1, 2, 5)
7. Task 10 (Q&A UI - depends on Task 5)
8. Task 6 (HTTP client - independent infrastructure)
9. Task 7 (provider generalization - depends on Task 6)
10. Task 8 (API provider - depends on Tasks 6, 7)
11. Task 11 (OpenCode - depends on Task 7)
12. Task 12 (dynamic tool grants - independent)

---

## Task 1: Server-side Tool Execution

### Summary
Move all tool execution logic into the Chorus server behind a unified `POST /api/tasks/:id/tools` endpoint. Replace the three tool binaries with a single thin `chorus-tools` binary that forwards requests to the API.

### Sub-steps

#### 1.1: Change `allowedTools` from `String` to `Array String`

**Files:**
- `packages/shared/Types.gren` - Change `AgentConfig.allowedTools` type, update encoder/decoder

**Details:**
- `allowedTools : String` becomes `allowedTools : Array String`
- Encoder uses `Encode.array Encode.string`
- Decoder uses `Decode.array Decode.string`

**Ripple effects:**
- `packages/chorus/src/Provider/ClaudeCode.gren` - `buildCliArgs` and `buildShellCommand` construct `--allowedTools` flag from the array
- `packages/chorus/src/Agent/Registry.gren` - Default agent configs use arrays
- `packages/chorus-ui/src/View/Agents.gren` - UI displays/edits array-based tools
- `packages/chorus-ui/src/Api.gren` - Decodes array

#### 1.2: Define Tool Execution Request/Response Types

**Files to create:**
- `packages/chorus/src/Web/ToolExecution.gren`

**Types:**
```
ToolExecutionRequest = { tool : String, params : Decode.Value }
ToolExecutionResponse = { success : Bool, result : Encode.Value, error : Maybe String }
ToolPermission = Allowed | Denied String
```

**Functions:**
- `decodeToolExecutionRequest : String -> Result String ToolExecutionRequest`
- `checkPermission : Array String -> String -> ToolPermission`
- `executeTool : ToolExecutionContext -> ToolExecutionRequest -> Task Error ToolExecutionResponse`

#### 1.3: Share Tool Source Between Packages

**Files:**
- `packages/chorus/gren.json` - Add `"../tools/src"` to `source-directories`

This lets the chorus server import `Tools.File`, `Tools.Validation`, `Tools.Json` directly.

#### 1.4: Implement Server-Side Tool Dispatch

**Files:**
- `packages/chorus/src/Web/ToolExecution.gren`

**Dispatch routing:**
| Tool | Implementation |
|------|---------------|
| `file.read` | `Tools.File.read` |
| `file.write` | `Tools.File.write` (existing files only) |
| `file.create` | `Tools.File.write` (new files only) |
| `file.patch` | `Tools.File.patch` |
| `file.delete` | `Tools.File.delete` |
| `file.list` | `Tools.File.list` |
| `file.search` | `Tools.File.search` |
| `task.get` | `Registry.getTask` (direct, no curl) |
| `task.list` | `Registry.listTasks` (direct, no curl) |
| `handoff` | Start handoff, return immediately |
| `completion-report` | See Task 2 |

#### 1.5: Add `file.create` Tool

**Files:**
- `packages/tools/src/Tools/File.gren` - Add `create` function (rejects if file exists)
- `packages/tools/src/Tools/Json.gren` - Add decoder/encoder
- `packages/tools/src/Tools/Help.gren` - Add help entry

Modify `write` to reject if file does NOT exist (existing files only).

#### 1.6: Add `POST /api/tasks/:id/tools` Route

**Files:**
- `packages/chorus/src/Web/Router.gren` - Add `ExecuteTool TaskId` variant
- `packages/chorus/src/Web/Api.gren` - Add `requestExecuteTool` handler
- `packages/chorus/src/Main.gren` - Wire route handling

**Handler flow:**
1. Look up task -> find current agent
2. Look up agent config -> get `allowedTools`
3. `checkPermission(allowedTools, toolName)`
4. `executeTool(context, request)`
5. `recordEvent(taskId, "tool_executed", ...)` to history
6. Return result

#### 1.7: Create `chorus-tools` CLI Binary

**Files to create:**
- `packages/tools/src/ChorusToolsMain.gren`

**Interface:**
```bash
chorus-tools <json_input>
# Env vars: CHORUS_BASE_URL, CHORUS_TASK_ID
```

**Logic:**
1. Read env vars for base URL and task ID
2. Parse JSON input from args
3. POST to `${CHORUS_BASE_URL}/api/tasks/${CHORUS_TASK_ID}/tools`
4. Print response to stdout
5. Special case: `handoff` tool does polling (start handoff, poll until complete)

#### 1.8: Update Build System

**Files:**
- `package.json` - Add `chorus-tools` build step (same Gren -> Bun pipeline)

#### 1.9: Update ClaudeCode Provider

**Files:**
- `packages/chorus/src/Provider/ClaudeCode.gren` - Use `chorusToolsPath`, set `CHORUS_TASK_ID` env var
- `packages/chorus/src/Main.gren` - Config updates, pass task ID to agent spawn

**Key change:** `--allowedTools` becomes `"Bash(chorus-tools *)"` for all agents. Fine-grained permissions enforced server-side.

#### 1.10: Tool Call Logging

Log every tool execution to task history:
```
eventType = "tool_executed"
data = { tool, status, duration_ms }
```

#### 1.11: Update Default Agent Configs

**Files:**
- `packages/chorus/src/Agent/Registry.gren`

**Mapping:**
| Agent | New allowedTools |
|-------|-----------------|
| researcher | `["web.search"]` |
| planner | `["file.read", "file.write", "file.create", "file.patch", "file.delete", "file.list", "file.search"]` |
| writer-workflow | `["handoff", "file.read", "file.write"]` |
| writer | `["file.read", "file.write", "file.create", "file.patch", "file.list", "file.search"]` |
| editor | `["file.read", "file.list", "file.search"]` |
| fact-checker | `["file.read", "file.list", "file.search", "web.search"]` |

---

## Task 2: Mandatory Completion-Report Tool

### Summary
Agents must call a `completion-report` tool to submit structured output with status, summary, output, and optional blocked reason. Chorus enforces this by checking tool call logs when the agent exits.

### Sub-steps

#### 2.1: Define CompletionReport Types

**Files:**
- `packages/shared/Types.gren`

**Types:**
```
type CompletionStatus = ReportComplete | ReportBlocked | ReportFailed

type alias CompletionReport =
    { status : CompletionStatus
    , summary : String
    , output : String
    , blockedReason : Maybe String
    }
```

Extend `HandoffRecord`:
```
type alias HandoffRecord =
    { agentName, startedAt, completedAt, output
    , completionReport : Maybe CompletionReport  -- NEW
    }
```

#### 2.2: Add Completion-Report API Route

**Files:**
- `packages/chorus/src/Web/Router.gren` - Add `SubmitCompletionReport TaskId` for `PUT /api/tasks/:id/completion-report`
- `packages/chorus/src/Web/Api.gren` - Handler: parse report, update handoff record, map status to task status
- `packages/chorus/src/Main.gren` - Wire route, add `GotCompletionReportResult` msg

**Status mapping:**
| Report Status | Task Status |
|--------------|-------------|
| `complete` | `Completed` |
| `blocked` | `Waiting` |
| `failed` | `Failed summary` |

#### 2.3: Track Completion Report Per Executor

**Files:**
- `packages/chorus/src/Main.gren`

Add `completionReportReceived : Bool` to `ExecutorState`. Set to `True` when the `SubmitCompletionReport` endpoint succeeds.

#### 2.4: Modify `GotAgentComplete` for Enforcement

**Files:**
- `packages/chorus/src/Main.gren`

When agent exits:
- If `completionReportReceived == True`: Cleanup only, report already handled status
- If `completionReportReceived == False`: Fall back to raw output, mark as needing attention

Future enhancement: Send follow-up message via `--resume` to request completion report.

#### 2.5: Agent System Prompt Injection

**Files:**
- `packages/chorus/src/Main.gren`

Inject instruction into system prompt: "IMPORTANT: Before finishing your work, you MUST call the completion-report tool..."

Auto-append `completion-report` to agent's allowed tools when spawning.

#### 2.6: UI for Structured Agent Output

**Files:**
- `packages/chorus-ui/src/View/TaskDetail.gren`

Display `HandoffRecord.completionReport` when present:
- Status badge (complete/blocked/failed)
- Summary text
- Collapsible output details
- Blocked reason for blocked tasks

---

## Task 3: Planning Agent Integration

### Summary
Auto-dispatch tasks to a `_planner` agent on creation. The planner returns a structured plan or questions for the user. New task states manage the planning flow.

### Sub-steps

#### 3.1: Create `_planner` Agent Config

**Files:**
- `packages/chorus/src/Agent/Registry.gren`

Add `_planner` to default seeds with system prompt instructing:
- Analyze task descriptions
- Return JSON: `{"type": "plan", "summary": ..., "assignedAgent": ...}` or `{"type": "questions", "questions": [...]}`
- Use markdown JSON code fence for output

#### 3.2: Add Question/Answer Fields to Task

**Files:**
- `packages/shared/Types.gren`

```
type alias PlanningQuestion = { question : String, answer : Maybe String }
```

Add to `PlannedTask`:
- `questions : Array PlanningQuestion`
- `assignedAgent : Maybe String`

Update encoders/decoders.

#### 3.3: Auto-Dispatch on Task Creation

**Files:**
- `packages/chorus/src/Main.gren`

After `requestCreateTask` succeeds and HTTP response is sent:
1. Set task status to `Planning`
2. Look up `_planner` agent config
3. Spawn planner as ChildProcess (same pattern as handoff spawning)
4. Handle `GotPlannerComplete` msg

#### 3.4: Parse Planner Output

**Files:**
- `packages/chorus/src/Main.gren` (or new `packages/chorus/src/Planner.gren`)

```
type PlannerOutput
    = PlanResult { summary, requirements, acceptanceCriteria, plan, assignedAgent }
    | QuestionsResult { questions : Array String }
```

Parser: Extract JSON from code fence, decode on `type` field.

#### 3.5: Handle Planner Results

In `GotPlannerComplete`:
- `PlanResult` -> Set planning fields on task, set status to `Planned`
- `QuestionsResult` -> Store questions on task, set status to `AwaitingInput`
- Parse failure -> Set status to `Failed`

Validate `assignedAgent` exists in agent registry.

#### 3.6: Answer Submission API

**Files:**
- `packages/chorus/src/Web/Router.gren` - Add `SubmitAnswers TaskId` for `POST /api/tasks/:id/answers`
- `packages/chorus/src/Web/Api.gren` - Handler: update questions with answers
- `packages/chorus/src/Main.gren` - Re-dispatch to planner with description + Q&A context

Creates a loop: `AwaitingInput` -> (user answers) -> `Planning` -> `Planned` or more questions.

#### 3.7: Status Transition Validation

Define valid transitions:
```
Pending -> Planning        (auto on creation)
Planning -> AwaitingInput  (planner has questions)
Planning -> Planned        (planner returned plan)
Planning -> Failed         (planner error)
AwaitingInput -> Planning  (user submitted answers)
Planned -> Active          (Start clicked, agent dispatched)
```

---

## Task 4: Agent-Driven Task Dispatch

### Summary
The Start button reads the task's plan to find the assigned agent and dispatches via the handoff API.

### Files to Modify
- `packages/chorus-ui/src/View/TaskDetail.gren` - Start button triggers `StartTask` msg instead of status update
- `packages/chorus-ui/src/Main.gren` - `StartTask` handler reads `assignedAgent`, calls `Api.startHandoff`
- `packages/chorus-ui/src/Api.gren` - `startHandoff` calls `POST /api/tasks/:id/handoff`

### Key Details
- Only show Start for `Planned` tasks with `assignedAgent` set
- Construct prompt from task planning fields (summary, requirements, acceptance criteria, plan)
- Backend already handles handoff spawning in `Main.gren`

### Dependencies
Task 5 (Planned status)

### Complexity: Medium

---

## Task 5: Task Status Refinements

### Summary
Add `Planning`, `AwaitingInput`, `Planned` to `TaskStatus`.

### Files to Modify
- `packages/shared/Types.gren` - Add variants, update all exhaustive matches (statusToString, statusFromString, encodeStatus, statusDecoder, statusEquals)
- `packages/chorus/src/Main.gren` - `parseStatusBody` accepts new strings
- `packages/chorus-ui/src/View/TaskDetail.gren` - Status actions per new status
- `packages/chorus-ui/src/View/Board.gren` - New kanban columns
- CSS/static files - Badge styles for new statuses

### Dependencies
None (foundational)

### Complexity: Medium

---

## Task 6: HTTP Client via Node Ports

### Summary
Implement outbound HTTP using Gren ports. Required for API providers.

### Files to Create/Modify
- `packages/chorus/src/HttpClient.gren` (new) - Port definitions and high-level API
- `packages/chorus/src/Main.gren` - Wire port subscriptions
- JavaScript glue in build pipeline - Node.js `fetch` implementation for the port

### Key Types
```
type alias Request = { method, url, headers, body, timeout }
type alias Response = { statusCode, headers, body }
type HttpError = Timeout | NetworkError String | BadStatus Int String
```

### Technical Considerations
- Gren 0.6.3 may not support task ports (needs verification)
- If Cmd/Sub ports only: correlation ID approach needed
- JavaScript implementation uses Node.js `fetch` or `http.request`

### Dependencies
None (infrastructure)

### Complexity: Large

---

## Task 7: Provider Generalization

### Summary
Refactor Provider interface to support both CLI providers (tools internal) and API providers (Chorus manages tool loop).

### Files to Modify
- `packages/chorus/src/Provider.gren` - Add `ProviderKind` (CliProvider | ApiProvider), add to Provider record
- `packages/chorus/src/Provider/ClaudeCode.gren` - Set `kind = CliProvider`
- `packages/chorus/src/Agent/Executor.gren` - Wire up tool execution loop for API providers
- `packages/chorus/src/Main.gren` - Provider factory based on agent config

### Dependencies
Task 6 (HTTP client), Task 9 (agent backend config)

### Complexity: Large

---

## Task 8: API Provider Implementation

### Summary
Implement OpenRouter or Ollama as an API provider.

### Files to Create
- `packages/chorus/src/Provider/OpenRouter.gren` (or `Ollama.gren`)

### Key Details
- Implements `Provider msg` with `kind = ApiProvider`
- Uses HTTP client (Task 6) for LLM API calls
- Manages conversation history across turns
- Handles tool call/response loop
- OpenAI-compatible request/response format

### Dependencies
Task 6 (HTTP client), Task 7 (generalized provider)

### Complexity: Large

---

## Task 9: Agent Backend Configuration

### Summary
Add `provider` and `model` fields to `AgentConfig`.

### Files to Modify
- `packages/shared/Types.gren` - Extend AgentConfig with `provider : String`, `model : Maybe String`
- `packages/chorus/src/Agent/Registry.gren` - Default configs include `provider = "claude-code"`
- `packages/chorus/src/Main.gren` - Provider dispatch based on agent config
- `packages/chorus-ui/src/View/Agents.gren` - Provider dropdown, model field
- Environment variables for provider config (API keys, base URLs)

### Dependencies
Task 4 (dispatch mechanism)

### Complexity: Small

---

## Task 10: Question/Answer UI

### Summary
UI components for displaying planning questions and collecting answers.

### Files to Modify
- `packages/chorus-ui/src/View/TaskDetail.gren` - `viewPlanningQuestions` section for `AwaitingInput` tasks
- `packages/chorus-ui/src/Main.gren` - `UpdateQuestionAnswer`, `SubmitAnswers` messages, draft answer state
- `packages/chorus-ui/src/Api.gren` - `submitAnswers` function

### Dependencies
Task 5 (AwaitingInput status)

### Complexity: Medium

---

## Task 11: OpenCode Provider

### Summary
Second CLI provider implementation for OpenCode.

### Files to Create
- `packages/chorus/src/Provider/OpenCode.gren`

### Key Details
- Same structure as ClaudeCode provider
- Different CLI binary, arguments, output format
- `kind = CliProvider`

### Dependencies
Task 7 (generalized provider)

### Complexity: Medium

---

## Task 12: Dynamic Tool Grants

### Summary
API for modifying a running agent's allowed tools at runtime.

### Files to Modify
- `packages/chorus/src/Web/Router.gren` - Add `UpdateAgentTools TaskId` route
- `packages/chorus/src/Web/Api.gren` - Handler: modify executor's allowedTools
- `packages/chorus/src/Main.gren` - Update `activeExecutors` dict

### Key Details
- `PUT /api/tasks/:id/agent-tools` with `{ addTools: [...], removeTools: [...] }`
- Updates in-memory executor state
- Server-side permission checks make changes immediate
- For CLI providers: requires `chorus-tools` binary to check permissions via API each call

### Dependencies
None (benefits from server-side tool execution)

### Complexity: Small
