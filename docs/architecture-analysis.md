# Architecture Analysis: Current State vs. Desired Design

## Desired System Summary

Chorus is a multi-agent orchestration system where:

1. A **main Chorus process** provides a REST API for tools and UI clients
2. Agents run **independently** using a variety of **back-ends** (OpenRouter, Ollama, LMStudio, Claude Code, OpenCode)
3. **Tasks** are the unit of work and the coordination point for multi-agent collaboration
4. **History entries** track when tasks are assigned, agents finish, work is transferred, etc.
5. The **UI** provides visibility into task state, agent output, and history for debugging and improving instructions
6. Agents use **only Chorus-provided tools** (local binaries), with tool approval/denial based on agent config (never user prompts)
7. **Task lifecycle**: User creates task via UI -> planning agent analyzes -> questions returned to user (if needed) -> user replies -> task enters "planned" status with Start button -> user clicks Start -> Chorus dispatches agent from plan -> agent may delegate to/query other agents via tools -> task completes or blocks for user intervention
8. The **`data/` directory** is created dynamically relative to where the Chorus binary is run from (i.e., the working directory). All persistent state (task registry, agent configs, workspaces, uploads) lives under `./data/`. This means the application is portable - copy the binary and its companion files (static assets, tool binary) anywhere, run it, and it creates its data directory in place.

---

## What Exists Today

### Core Infrastructure (Solid Foundation)

| Component | Status | Notes |
|-----------|--------|-------|
| HTTP server with REST API | **Done** | Full CRUD for tasks, agents, attachments, history, queue |
| Task registry (file-based) | **Done** | JSON files in `./data/registry/` (relative to working directory) |
| Agent registry (file-based) | **Done** | JSON files in `./data/agents/` with CRUD API |
| Web UI (Gren SPA) | **Done** | Board view, task detail, agent management, history timeline |
| Task status lifecycle | **Done** | Pending -> Active -> Waiting -> Completed/Failed with transitions |
| History/event tracking | **Partial** | Events recorded for task_created, agent_handoff_started, agent_handoff_completed |
| Agent handoff API | **Done** | `POST /api/tasks/:id/handoff` and `PUT /api/tasks/:id/handoff/complete` |
| Agent chain tracking | **Done** | `agentChain` array with HandoffRecord (agentName, startedAt, completedAt, output) |
| File tools binary | **Done (needs migration)** | 6 operations: read, write, patch, delete, list, search with path sandboxing. Logic needs to move server-side. |
| Handoff tool binary | **Done (needs migration)** | Initiates handoff via API, polls for completion. Will become a server-side tool. |
| Task tools binary | **Done (needs migration)** | Queries task status via API (task.get, task.list). Will become a server-side tool. |
| Workspace isolation | **Done** | Per-task workspace at `./data/workspaces/{task-id}/` |
| Agent spawning (Claude Code) | **Done** | Spawns `claude` CLI as subprocess with system prompt, allowed tools, workspace |
| Agent completion handling | **Done** | On CLI exit, records handoff completion, updates task |

### Provider Interface (Partially Built)

| Component | Status | Notes |
|-----------|--------|-------|
| Abstract Provider type | **Done** | `Provider msg` record with validateEnvironment, createSession, sendMessage, submitToolResults, resumeSession |
| ClaudeCode provider | **Done** | Spawns `claude` CLI, parses JSON output, handles sessions |
| Executor module | **Done** | State machine for agent conversation loop (Loading -> Validating -> WaitingForSession -> Active -> Complete/Failed) |

### UI Features

| Component | Status | Notes |
|-----------|--------|-------|
| Kanban board | **Done** | Columns for each task status |
| Task creation | **Done** | Simple description field |
| Task detail view | **Done** | Status, planning fields, attachments, history, message queue |
| Planning fields | **Done** | Summary, requirements, acceptance criteria, plan (editable inline) |
| Agent CRUD | **Done** | Create/edit/delete agents with name, instructions, allowedTools |
| History timeline | **Done** | Shows events in reverse chronological order |
| Status transitions | **Done** | Buttons for Start, Pause, Resume, Complete, Failed, Reopen, Retry |
| 2-second polling | **Done** | Auto-refresh for board, task detail, agents |

---

## Gap Analysis: What's Missing or Incompatible

### 1. Planning Agent (Not Implemented)

**Desired:** When a user creates a task, Chorus automatically sends it to an internal planning agent that returns structured output (plan + questions for user).

**Current:** Tasks are created in Pending status with just a description. Planning fields (summary, requirements, acceptance criteria, plan) exist but are **manually edited by the user** through the UI. There is no automatic planning step.

**What's needed:**
- A designated planning agent configuration (could be a reserved agent name like `_planner`)
- On task creation, Chorus should automatically dispatch the task description to the planning agent
- The planning agent needs a structured output format: either the task is simple enough to plan directly, or it has questions for the user
- A new task status or sub-state for "awaiting user answers to planning questions"
- API endpoint or mechanism for the planning agent to return structured output (plan fields + optional questions)
- UI changes to display questions and accept user replies before showing the Start button

### 2. Multiple Backend Providers (Only Claude Code Exists)

**Desired:** Support for OpenRouter, Ollama, LMStudio, Claude Code, and OpenCode as backends.

**Current:** Only the `ClaudeCode` provider is implemented. The abstract `Provider` interface exists but is tightly coupled to Claude Code's execution model:
- `submitToolResults` is a no-op that returns an error ("handled internally by CLI")
- `createSession` sends a throw-away "hello" message just to get a session ID
- The response type assumes `isComplete` is always `True` (CLI handles tools internally)

**Incompatibilities with desired backends:**

| Backend | Model | Incompatibility |
|---------|-------|-----------------|
| **OpenRouter** | HTTP API | Requires real tool call/response loop. Current Provider interface supports this but Executor never exercises it. Need HTTP client. |
| **Ollama** | HTTP API (local) | Same as OpenRouter. Also needs model configuration per agent. |
| **LMStudio** | HTTP API (local) | Same as OpenRouter/Ollama. OpenAI-compatible API. |
| **Claude Code** | CLI subprocess | **Working today.** Tools handled internally by CLI. |
| **OpenCode** | CLI subprocess | Similar to Claude Code but different CLI arguments and output format. Would need a new provider implementation. |

**What's needed:**
- Generalize the Provider interface to properly support both execution models:
  - **CLI providers** (Claude Code, OpenCode): Tools executed internally, response is final
  - **API providers** (OpenRouter, Ollama, LMStudio): Chorus manages the tool call loop, executing tools and submitting results back
- Agent configuration needs a `backend` or `provider` field to specify which provider to use
- Provider configuration (API keys, base URLs, model names) needs to be stored somewhere (likely environment variables or a config file)
- The Executor module's conversation loop needs to actually work for API providers (it's structured correctly but never exercised)
- **HTTP client via Node ports** - Gren doesn't have a native HTTP client. The approach is to implement outbound HTTP requests using Node.js ports (the Gren interop mechanism for side effects). This avoids the current pattern of shelling out to `curl` via ChildProcess, which is brittle and hard to extend. The port-based HTTP client would be used by all API providers and could replace the curl-based approach in the tool binaries as well.

### 3. Agent-to-Agent Communication (Partially Implemented)

**Desired:** Agents can use tools to ask questions of other agents or send work to specialized agents.

**Current:** The handoff tool exists and works, but it's a **full handoff** - it transfers the entire task to another agent, waits for completion, then returns. This is agent delegation, not inter-agent communication.

**What's needed:**
- The handoff tool already covers the "send work to a specialized agent" use case
- For "ask questions of other agents," a lighter-weight tool may be needed (query without full task handoff)
- Alternatively, the handoff tool's polling model may be sufficient if agents can hand off sub-problems and get responses
- The current model where an agent hands off and the original agent gets the output back is close to what's desired

### 4. Task Lifecycle Mismatch

**Desired flow:**
1. User creates task -> **Chorus auto-dispatches to planning agent**
2. Planning agent returns structured output (plan or questions)
3. If questions: displayed in UI, user replies
4. Task is now "planned" with Start button available
5. User clicks Start -> Chorus starts the agent identified in the plan
6. Agent works, may delegate
7. Agent response determines completion or blocked status

**Current flow:**
1. User creates task -> task is Pending with description only
2. User manually edits planning fields (summary, requirements, etc.)
3. User clicks Start (any Pending task can be started)
4. **Start does not spawn an agent** - it just changes status to Active
5. Agent handoff is triggered by a separate API call (`POST /api/tasks/:id/handoff`) specifying agent name and prompt
6. Agent works via CLI subprocess
7. On completion, handoff is recorded and task goes to Waiting

**Key mismatches:**
- No automatic planning step on task creation
- No concept of "questions for the user" from the planning agent
- The Start button just changes status; it doesn't dispatch to an agent
- The plan doesn't identify which agent to use - the handoff API requires explicit agent name
- No concept of the agent marking a task as blocked (needing user intervention)
- Status transitions are UI-driven, not agent-driven

**What's needed:**
- Task creation triggers automatic planning dispatch
- New states or sub-states: "planning", "awaiting_user_input", "planned"
- The plan output should include which agent to assign
- Start button should read the plan and dispatch to the identified agent
- Agents need a tool or mechanism to signal "blocked" (needs user intervention)
- Agent responses should be able to set task status (complete, blocked, etc.)

### 5. Tool Architecture (Needs Redesign)

**Desired:** The Chorus server handles all tool execution directly. Tool requests come in via API, Chorus checks permissions against the agent's allowed-tools list, executes the tool, logs the call, and returns the result. For CLI-based backends (Claude Code, OpenCode), a thin `chorus-tools` binary exists solely to forward the request to the Chorus API and print the response. Fine-grained permissions (e.g., read-only vs. read-write vs. read-write-create). In the future, a supervisor agent can dynamically add tools to an agent's allowed list.

**Current:** Three separate binaries (file-tools, handoff-tool, task-tools) with coarse-grained separation. Each binary enforces that only its own tool category is accepted and executes tools directly. The agent's `allowedTools` field is a free-form string with Claude Code-specific syntax (e.g., `"Bash(tools/file-tools *)"`), passed directly as CLI flags.

**Problems with current approach:**
- **Too coarse-grained**: file-tools bundles read and write together, so you can't have a read-only agent vs. a read-write agent. You also can't distinguish "can modify existing files" from "can create new files."
- **No unified tool logging**: Tool calls are not centrally logged since they happen inside separate binaries.
- **Backend-specific permissions**: The `allowedTools` string only works for Claude Code's `--allowedTools` flag. Other backends would need a different mechanism.
- **Three binaries is awkward**: Each binary has its own main, its own argument parsing, and enforces tool separation at the binary level rather than via a permission check.
- **Tool logic is in the wrong place**: The binaries implement file operations, path validation, and API calls independently from the Chorus server. This means Chorus has no visibility into what tools are doing at execution time.

**What's needed:**

**Single internal tool execution pipeline:**

Chorus has one tool execution path regardless of backend. The pipeline is:

1. Receive tool request (tool name, input, agent/task context)
2. Check tool name against the agent's allowed-tools list
3. Execute the tool
4. Log the call (timestamp, tool name, input summary, result status) into task history
5. Return the result

How tool calls reach this pipeline differs by backend type, but after entry the path is identical:

- **API backends** (OpenRouter, Ollama, LMStudio): Chorus manages the LLM conversation loop directly. When the LLM response includes tool calls, Chorus feeds them into the pipeline in-process - no HTTP, no binary.
- **CLI backends** (Claude Code, OpenCode): The CLI manages its own conversation loop. When the LLM requests a tool, the CLI invokes the `chorus-tools` binary, which POSTs to `POST /api/tasks/:id/tools`. This is the only API endpoint needed for tool execution, and it exists solely as the entry point for CLI-based providers. On the server side, the request is fed into the same pipeline.

This means the tool execution API endpoint is an adapter for CLI providers, not a general-purpose interface. API providers never touch it.

**Thin CLI binary (`chorus-tools`):**
- A single binary replaces the current three
- Does nothing except: receive tool JSON on stdin/args, POST it to the Chorus API, print the response to stdout
- All permission checking, execution, and logging happens server-side
- Needs to know the Chorus base URL and the task ID (passed as arguments or environment variables)

**Fine-grained file permissions:**
- Instead of a single "file-tools" permission, separate tools: `file.read`, `file.write`, `file.create`, `file.delete`, `file.patch`, `file.list`, `file.search`
- Chorus implements these with the appropriate permission checks (e.g., `file.write` only works on existing files, `file.create` is needed to make new files)
- Path validation and workspace sandboxing remain, enforced server-side

**Pass-through tools:**
- For capabilities that don't need fine-grained control, Chorus can delegate to native tools (e.g., `grep`, `ripgrep`) while still logging the call and validating the tool name is allowed

**Backend-agnostic permissions:**
- Agent config stores a list of allowed tool names
- For CLI backends: Chorus tells the CLI to use the `chorus-tools` binary, which routes everything through the API into the shared pipeline
- For API backends: Chorus only presents allowed tools in the LLM API request and executes tool calls in-process through the same pipeline
- Same permission model, same logging, same enforcement regardless of backend

**Future: dynamic tool grants:**
- A supervisor agent could call a Chorus API to add tools to a running agent's allowed list
- Since permission checks happen server-side on every call, changes take effect immediately

### 6. Agent Output Capture (Needs Redesign)

**Desired:** Agent output is always captured via a mandatory tool call. The UI shows structured output for each agent along the way for debugging.

**Current:** The `agentChain` tracks agent name, start/end times, and output text per handoff. History events record handoff start/complete. The UI displays history events and the agent chain. Output is captured from the CLI's stdout after the process exits.

**Problems with current approach:**
- Output is raw CLI stdout text, which may not be well-structured
- No guarantee the agent produces useful output - it might exit with an empty or malformed response
- No visibility into tool calls made during execution
- No streaming/real-time output during agent execution

**What's needed - mandatory completion tool:**

Agent output should be captured exclusively through a `completion-report` tool call that the agent is required to invoke before finishing. This enforces structured output and ensures Chorus always gets actionable data.

**Enforcement mechanism:**
1. Agent runs and eventually stops (either by calling a control tool or by the LLM ending its turn)
2. **Control tools** that legitimately end an agent's turn without a completion report: `ask-question` (pauses to ask the user or another agent something), `delegate-to-agent` (hands off to a specialist and waits)
3. If the agent stops **without** having called `completion-report` or a control tool, Chorus sends a follow-up message instructing the agent that it must call `completion-report` with its findings
4. If the agent still fails to comply after a retry, Chorus marks the handoff as failed with the raw output captured as a fallback

**Server-side enforcement advantage:** Since all tool calls now flow through the Chorus API (see gap #5), Chorus has full visibility into which tools the agent has called during its session. When the agent process exits or the LLM ends its turn, Chorus can check its tool call log for that session to determine whether `completion-report`, `ask-question`, or `delegate-to-agent` was called. No need to parse CLI output or guess - the server already has the data.

**`completion-report` tool spec:**
- `status`: "complete" | "blocked" | "failed"
- `summary`: Brief description of what was accomplished
- `output`: Detailed output/artifacts
- `blockedReason`: (if blocked) What the agent needs from the user
- This replaces the current approach of parsing raw CLI output to determine task state

This design also solves the agent-driven status change problem (gap #8) since the completion report explicitly carries the agent's assessment of task state.

### 7. Task Questions/Replies (Not Implemented)

**Desired:** Planning agent can return questions for the user. UI displays questions with reply area. User sends reply. This happens before the task is started.

**Current:** The message queue (`/api/tasks/:id/queue`) exists and can store messages, but it's a generic message queue with no structure for questions/answers. The UI displays queued messages but has no special handling for questions.

**What's needed:**
- Structured question format in the planning agent's output
- UI component for displaying questions and collecting answers
- API endpoint or mechanism for submitting answers
- Logic to re-send answers to the planning agent for plan refinement
- The plan output should have a clear "ready to start" signal

### 8. Agent-Driven Status Changes (Not Implemented)

**Desired:** Based on agent's response (or a tool call), Chorus marks task as complete or blocked.

**Current:** Status changes are only made through the REST API (`PUT /api/tasks/:id/status`). The agent completion handler (`GotAgentComplete`) records the handoff as complete and sets the task to Waiting, but doesn't analyze the agent's response to determine if the task is done.

**Addressed by the mandatory `completion-report` tool (see gap #6).** The completion report carries a `status` field ("complete", "blocked", "failed") that Chorus uses to update task state. This replaces the need for separate `task.complete` / `task.block` tools and eliminates the ambiguity of trying to parse raw agent output for status signals.

**What's still needed beyond the completion-report design:**
- Chorus must map the completion report's status to task status transitions (e.g., "complete" -> Completed, "blocked" -> Waiting with blocked reason stored)
- The `GotAgentComplete` handler needs to parse the last tool call to check for completion-report data
- History events should record the completion report contents for audit trail

---

## Summary of Work Required

### High Priority (Core Flow)

1. **Server-side tool execution** - Move all tool logic into the Chorus server behind a tool execution API endpoint. Replace the three binaries with a single thin `chorus-tools` binary that just forwards requests to the API. Implement fine-grained file permissions (read/write/create/delete as separate tools). Log all tool usage server-side.
2. **Mandatory completion-report tool** - Agents must call `completion-report` to submit structured output. Chorus enforces this by checking its server-side tool call log when an agent exits and sending a follow-up message if needed.
3. **Planning agent integration** - Auto-dispatch on task creation, structured output parsing, question/answer flow
4. **Agent-driven task dispatch** - Start button reads plan and spawns the identified agent
5. **Task status refinements** - New states for planning, awaiting input, planned; completion-report drives task status

### Medium Priority (Multi-Backend)

6. **HTTP client via Node ports** - Implement outbound HTTP using Gren ports to replace curl-via-ChildProcess pattern. Required for API providers.
7. **Provider generalization** - Refactor Provider interface to support both CLI and API execution models
8. **API provider implementation** - At least one API provider (OpenRouter or Ollama) to prove the abstraction
9. **Agent backend configuration** - Add provider/backend field to agent config

### Lower Priority (Polish)

10. **Question/answer UI** - Dedicated UI components for planning questions
11. **OpenCode provider** - Second CLI provider implementation
12. **Dynamic tool grants** - Supervisor agent can add tools to a running agent's allowed list

### Already Working Well

- File-based storage model (tasks, agents, history)
- REST API surface area
- Web UI structure and navigation
- Core file operations logic (read, write, patch, delete, list, search) - implementations are sound, need to move server-side
- Handoff logic for agent delegation - needs to move server-side
- Basic agent spawning and completion tracking
- History event recording
- Workspace isolation per task
- Path validation and security sandboxing
