# Task: Implement Agent Executor with Provider Abstraction

## Summary

Build the agent executor that runs LLM-based agents with a provider abstraction layer. The executor logic is decoupled from the specifics of any LLM service, allowing future support for multiple providers (Claude Code SDK, direct Anthropic API, OpenAI, local models, etc.). The initial implementation includes the Claude Code provider.

## Requirements

- Create a Gren agent executor (`src/agent-executor/`) that loads agent specs and manages conversation flow
- Implement a **Provider interface** that abstracts LLM communication (session management, message sending, tool result submission)
- Implement the **Claude Code provider** as the first provider, using Task ports to a TypeScript SDK bridge
- Create a TypeScript SDK bridge (`src/sdk-bridge/`) that wraps the Claude Code SDK
- Define custom MCP tools that invoke the `file-tools` binary for file operations
- Support session persistence by storing/loading session IDs
- Works with Claude Pro/Max subscriptions (no API key needed) via the Claude Code provider

## Acceptance Criteria

### Provider Abstraction
- [ ] Provider interface defines: `createSession`, `sendMessage`, `submitToolResults`, `resumeSession`
- [ ] Executor uses Provider interface only - no direct coupling to Claude Code SDK
- [ ] Provider is selected via configuration (initially just Claude Code)
- [ ] Adding a new provider requires only implementing the interface, no executor changes

### Agent Executor
- [ ] Gren executor loads agent specs from `agents/*.md` files
- [ ] Gren executor extracts system prompt from agent markdown (content before first ## heading)
- [ ] Conversation continues until agent produces final response (no pending tool calls)
- [ ] Session IDs are persisted to `{workspace}/.session` for conversation resumption
- [ ] Errors from provider or tools are surfaced with clear messages

### Claude Code Provider
- [ ] Task ports successfully call TypeScript SDK bridge functions
- [ ] SDK bridge creates new sessions and returns session IDs
- [ ] SDK bridge resumes existing sessions from stored session IDs
- [ ] MCP tools route calls to file-tools binary with correct workspace root
- [ ] Tool results are parsed and returned in SDK-expected format

### Testing
- [ ] Unit tests pass for agent spec parsing
- [ ] Unit tests pass for provider interface types
- [ ] Integration test demonstrates end-to-end conversation with tool use

## Out of Scope

- XMPP integration (separate task)
- Web dashboard (separate task)
- Multiple concurrent agents (requires orchestrator)
- Rate limiting and timeouts
- Reviewer agent security validation
- Privilege separation / security hardening
- Additional providers beyond Claude Code (Anthropic API, OpenAI, etc.) - future tasks will add these

## Future Providers

The provider abstraction enables adding new LLM backends without modifying the executor. Future providers might include:

| Provider | Implementation Notes |
|----------|---------------------|
| Anthropic API | Direct HTTP calls to api.anthropic.com, requires API key |
| OpenAI | Direct HTTP calls to api.openai.com, different tool format |
| Local Models | Ollama or similar, runs locally, no auth needed |
| AWS Bedrock | Claude via AWS, uses AWS credentials |

Each provider would implement the same interface (`createSession`, `sendMessage`, `submitToolResults`, `resumeSession`) with provider-specific logic.

## Technical Context

### Files to Create

**Gren side (`src/agent-executor/`):**

| File | Purpose |
|------|---------|
| `gren.json` | Project config (platform: node, dependencies: gren-lang/core, gren-lang/node) |
| `src/Main.gren` | CLI entry point, argument parsing, initialization |
| `src/Agent/Spec.gren` | Parse agent specs from markdown files |
| `src/Agent/Executor.gren` | Orchestration logic, conversation loop (uses Provider interface) |
| `src/Provider.gren` | **Provider interface** - types and function signatures for LLM communication |
| `src/Provider/ClaudeCode.gren` | **Claude Code provider** - implements Provider using Task ports |
| `src/Provider/Ports.gren` | Task port definitions for Claude Code SDK bridge |

**TypeScript side (`src/sdk-bridge/`):**

| File | Purpose |
|------|---------|
| `package.json` | Dependencies including `@anthropic-ai/claude-code` |
| `tsconfig.json` | TypeScript configuration |
| `src/index.ts` | Main bridge module, exports for Gren ports |
| `src/client.ts` | ClaudeSDKClient wrapper with session management |
| `src/tools.ts` | Custom MCP tool definitions for file operations |
| `src/types.ts` | TypeScript types for port communication |

### Related Files (reference only)

| File | Relevance |
|------|-----------|
| `src/tools/build/file-tools` | Binary to invoke for file operations |
| `src/tools/src/Main.gren` | Example of Gren CLI application pattern |
| `src/tools/src/Tools/Json.gren` | JSON encoding/decoding patterns |
| `agents/developer.md` | Example agent specification format |
| `docs/gren-language.md` | Gren syntax and Task ports reference |

### Patterns to Follow

**Gren CLI pattern (from `src/tools/src/Main.gren`):**
```gren
main : Node.SimpleProgram a
main =
    Node.defineSimpleProgram init

init : Node.Environment -> Init.Task (Cmd a)
init env =
    Init.await FileSystem.initialize <|
        \fsPermission ->
            -- Initialize and run
```

**Task port pattern (from `docs/gren-language.md`):**
```gren
-- Gren side: define a task port
port sendMessage : { sessionId : String, message : String } -> Task Json.Decode.Value String
```

```javascript
// JavaScript side: implement the port
Gren.Main.init({
  taskPorts: {
    sendMessage: async function({ sessionId, message }) {
      return await client.sendMessage(sessionId, message);
    }
  }
})
```

**Error handling pattern (from `src/tools/src/Tools/File.gren`):**
- Use custom error types with `when` pattern matching
- Convert errors to clear, actionable messages
- Return structured JSON for all outputs

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CLI: agent-executor <agent_spec> <workspace> [--provider=X]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Gren Agent Executor (src/agent-executor/)                      │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Main.gren   │→ │ Spec.gren    │→ │ Executor.gren │         │
│  │  (CLI args)  │  │ (parse MD)   │  │ (conv loop)   │         │
│  └──────────────┘  └──────────────┘  └──────┬───────┘         │
│                                              │                  │
│  ┌───────────────────────────────────────────▼───────────────┐ │
│  │  Provider Interface (Provider.gren)                        │ │
│  │                                                            │ │
│  │  - createSession : AgentSpec -> Task ProviderError Session │ │
│  │  - sendMessage : Session -> String -> Task ProviderError Response │
│  │  - submitToolResults : Session -> Results -> Task ProviderError Response │
│  │  - resumeSession : SessionId -> Task ProviderError (Maybe Session) │
│  └───────────────────────────────────────────┬───────────────┘ │
│                                              │                  │
│         ┌────────────────┬───────────────────┤                 │
│         ▼                ▼                   ▼                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ClaudeCode  │  │ Anthropic  │  │  OpenAI    │  (future)     │
│  │ Provider   │  │  Provider  │  │  Provider  │               │
│  └─────┬──────┘  └────────────┘  └────────────┘               │
│        │ Task Ports                                            │
└────────│───────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  TypeScript SDK Bridge (src/sdk-bridge/)                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  index.ts    │→ │  client.ts   │→ │  tools.ts    │         │
│  │  (exports)   │  │ (SDK wrap)   │  │ (MCP tools)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                              │                  │
│                              Claude Code SDK │                  │
└──────────────────────────────────────────────│──────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  MCP Tool Invocations                                           │
│                                                                 │
│  file.read  → file-tools <workspace> '{"tool":"file.read",...}'│
│  file.write → file-tools <workspace> '{"tool":"file.write",...}'│
│  ...                                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Provider Interface

The Provider interface abstracts LLM communication so the executor doesn't depend on any specific service:

```gren
-- Provider.gren

type alias Session =
    { id : String
    , provider : ProviderType
    , agentSpec : AgentSpec
    }

type alias Response =
    { text : String
    , toolCalls : Array ToolCall
    , isComplete : Bool  -- True if no pending tool calls
    }

type alias ToolCall =
    { id : String
    , name : String
    , input : Json.Decode.Value
    }

type alias ToolResult =
    { toolCallId : String
    , output : String
    , isError : Bool
    }

type ProviderError
    = AuthenticationError String
    | RateLimitError String
    | NetworkError String
    | InvalidResponseError String

-- Provider operations (implemented by each provider)
type alias Provider =
    { createSession : AgentSpec -> String -> Task ProviderError Session
    , sendMessage : Session -> String -> Task ProviderError Response
    , submitToolResults : Session -> Array ToolResult -> Task ProviderError Response
    , resumeSession : String -> Task ProviderError (Maybe Session)
    }
```

Each provider (Claude Code, Anthropic API, OpenAI, etc.) implements this interface. The executor calls these functions without knowing how they're implemented.

## Claude Code Provider: SDK Bridge API

The TypeScript bridge exposes these functions for Gren Task ports (used by the Claude Code provider):

### `createSession`
```typescript
interface CreateSessionInput {
  agentSpec: {
    systemPrompt: string;
    name: string;
  };
  workspaceRoot: string;
}

interface CreateSessionOutput {
  sessionId: string;
}
```

### `sendMessage`
```typescript
interface SendMessageInput {
  sessionId: string;
  message: string;
}

interface SendMessageOutput {
  response: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: object;
  }>;
  isComplete: boolean;  // true if no pending tool calls
}
```

### `submitToolResults`
```typescript
interface SubmitToolResultsInput {
  sessionId: string;
  results: Array<{
    toolCallId: string;
    output: string;  // JSON string
    isError: boolean;
  }>;
}

// Returns same shape as SendMessageOutput
```

### `resumeSession`
```typescript
interface ResumeSessionInput {
  sessionId: string;
}

interface ResumeSessionOutput {
  exists: boolean;
  lastMessage?: string;
}
```

## MCP Tool Definitions

Register these tools with the Claude Code SDK:

```typescript
const tools = {
  "file.read": {
    description: "Read a file from the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        offset: { type: "number", description: "Line to start from (optional)" },
        limit: { type: "number", description: "Max lines to read (optional)" }
      },
      required: ["path"]
    }
  },
  "file.write": {
    description: "Write content to a file in the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  },
  "file.patch": {
    description: "Apply find/replace patches to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" },
        patches: {
          type: "array",
          items: {
            type: "object",
            properties: {
              find: { type: "string" },
              replace: { type: "string" },
              startLine: { type: "number" }
            },
            required: ["find", "replace"]
          }
        }
      },
      required: ["path", "patches"]
    }
  },
  "file.delete": {
    description: "Delete a file from the workspace",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path relative to workspace" }
      },
      required: ["path"]
    }
  },
  "file.list": {
    description: "List files in a directory",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: workspace root)" },
        pattern: { type: "string", description: "Glob pattern to filter files" }
      }
    }
  },
  "file.search": {
    description: "Search for a pattern in files using ripgrep",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex)" },
        path: { type: "string", description: "Directory to search (default: workspace root)" },
        glob: { type: "string", description: "File glob pattern" },
        caseSensitive: { type: "boolean", description: "Case sensitive search (default: true)" },
        contextLines: { type: "number", description: "Lines of context around matches" },
        maxResults: { type: "number", description: "Maximum results (default: 100)" }
      },
      required: ["pattern"]
    }
  }
};
```

Each tool invocation:
1. Receives tool input from the SDK
2. Serializes to JSON
3. Spawns `file-tools <workspace_root> <json_input>`
4. Parses stdout as JSON result
5. Returns to SDK

## CLI Interface

```
Usage: agent-executor <agent_spec> <workspace_root> [session_id]

Arguments:
  agent_spec      Path to agent markdown file (e.g., agents/developer.md)
  workspace_root  Directory for file operations
  session_id      Optional: resume an existing session

Example:
  agent-executor agents/developer.md /var/chorus/workspaces/task-1
  agent-executor agents/developer.md /var/chorus/workspaces/task-1 sess_abc123
```

The executor reads initial parameters from stdin as JSON:
```json
{
  "TASK_FILE": "tasks/feature-a.md",
  "STATUS_FILE": "workspaces/feature-a/status.md",
  "REPORT_FILE": "workspaces/feature-a/reports/developer-1.md"
}
```

## Conversation Loop

```
1. Load agent spec from markdown file
2. Select provider based on configuration (default: Claude Code)
3. Create or resume session via provider.createSession / provider.resumeSession
4. Send initial message via provider.sendMessage
5. While response.isComplete == False:
   a. For each tool call in response.toolCalls, invoke file-tools binary
   b. Collect results as ToolResult records
   c. Submit tool results via provider.submitToolResults
   d. Process new response
6. Return final response text
7. Save session ID to {workspace}/.session
```

The executor logic remains the same regardless of which provider is used. The provider handles all LLM-specific communication.

## Testing Requirements

### Unit Tests (Gren)
- Agent spec parsing extracts system prompt correctly (content before first `##`)
- Agent spec parsing extracts agent name from title (`# Name`)
- Parameter parsing handles all expected fields
- JSON encoding/decoding for port communication works correctly

### Unit Tests (TypeScript)
- Tool definitions match expected schema
- File-tools invocation constructs correct command line
- Response parsing handles success and error cases
- Session ID generation produces unique IDs

### Integration Tests
- End-to-end: create session, send message, receive response
- Tool invocation: message triggers file.read, result returned correctly
- Session resume: create session, save ID, resume later with same history
- Error handling: invalid agent spec, SDK errors, tool failures

### Manual Testing
- Run with `agents/developer.md` and verify conversation flow
- Verify file operations work through the MCP tool chain
- Test with Claude Pro/Max authentication (no API key)

## Dependencies

### Gren (src/agent-executor/gren.json)
```json
{
  "type": "application",
  "platform": "node",
  "source-directories": ["src"],
  "gren-version": "0.6.3",
  "dependencies": {
    "direct": {
      "gren-lang/core": "7.0.0",
      "gren-lang/node": "6.1.0"
    },
    "indirect": {
      "gren-lang/url": "6.0.0"
    }
  }
}
```

### TypeScript (src/sdk-bridge/package.json)
```json
{
  "name": "chorus-sdk-bridge",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@anthropic-ai/claude-code": "^0.x.x"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Note: The exact claude-code SDK version should be determined when starting implementation.

## Implementation Notes

### Session Storage
Session IDs are stored in the workspace directory:
```
{workspace}/.session
```
This allows resuming conversations when re-invoking agents on the same task.

### SDK Authentication
The Claude Code SDK handles authentication automatically for Claude Pro/Max subscribers. Users authenticate via `claude login` before running the executor. No API key management is needed in this component.

### Error Handling Strategy
1. SDK errors (auth, rate limit, network) -> surface to user with actionable message
2. Tool errors (file not found, permission denied) -> return as tool result, let agent handle
3. Parse errors (invalid JSON, unexpected response) -> log details, return generic error

### Agent Spec Format
Agent specs are markdown files with this structure:
```markdown
# Agent Name

System prompt content goes here (everything before the first ## heading).

## Parameters
...

## Your Workflow
...
```

The system prompt is extracted as all content between the title and the first `##` heading.
