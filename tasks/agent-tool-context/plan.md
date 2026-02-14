# Task: agent-tool-context

## Summary

Add a tool context section to the system prompt of user-defined agents so they know what chorus-tools are available and how to invoke them. Currently, agents are given CLI access via `--allowedTools "Bash(chorus-tools *)"` but receive no information about what tools exist, their purpose, or how to call them.

## Background

When an agent is spawned via `buildAgentSpawn` in `Main.gren`, the system prompt includes the agent's instructions and the completion-report instruction, but nothing about the tools available through the `chorus-tools` binary. The agent must discover tools blindly, leading to wasted turns and errors.

The `Tools.Help` module already contains structured help data for every tool (name, description, required/optional parameters, output schema). This task reuses that data to generate a compact tool context string filtered to only the tools in the agent's `allowedTools` list.

### Tool invocation format

Agents call chorus-tools via Bash with a JSON payload:

```
chorus-tools <workspace-root> '{"tool": "<tool-name>", ...params}'
```

The server-side tool execution (`Web/ToolExecution.gren`) also accepts tools via HTTP POST to `/api/tasks/:taskId/tools`, but the CLI-spawned agents use the Bash-based invocation.

### Complete tool inventory

| Tool Name | Category | Description |
|---|---|---|
| `file.read` | File (chorus-tools) | Read file contents with optional pagination |
| `file.create` | File (chorus-tools) | Create a new file |
| `file.write` | File (chorus-tools) | Write content to an existing file |
| `file.patch` | File (chorus-tools) | Apply find-and-replace patches |
| `file.delete` | File (chorus-tools) | Delete a file |
| `file.list` | File (chorus-tools) | List files in a directory |
| `file.search` | File (chorus-tools) | Search for patterns in files |
| `handoff` | Orchestration (chorus-tools) | Hand off work to another agent |
| `web.search` | Native (Claude WebSearch) | Web search (handled by Claude CLI natively) |
| `task.get` | Task (server-side) | Get task details |
| `task.list` | Task (server-side) | List tasks |
| `help` | Meta (server-side) | List all available tools |
| `completion-report` | Meta (auto-granted) | Submit structured completion report |

Notes:
- `completion-report` is auto-granted and already described in the system prompt via `completionReportInstruction`. It does NOT need to appear in the tool context section.
- `web.search` maps to Claude's native `WebSearch` tool at the CLI level, not a chorus-tools invocation.
- `task.get` and `task.list` are server-side tools that also go through the chorus-tools binary.

## Approach

### 1. Create a `toolContextForAgent` function

Add a new function in `Main.gren` (or a new module if preferred) that takes an `Array String` of allowed tool names and returns a `String` containing the compact tool context block.

The function should:
- Filter the full tool catalog to only tools in the agent's `allowedTools` list
- Generate a compact text block describing each tool's purpose and parameters
- Include the chorus-tools invocation format at the top
- Handle `web.search` differently (explain it's a native Claude tool, not a chorus-tools call)
- Handle `handoff` with its specific parameters (agentName, prompt)

### 2. Compact format design

The tool context should be concise to minimize token usage. Proposed format:

```
## Available Tools

You have access to the following tools via the chorus-tools binary. Invoke tools using Bash:
chorus-tools <workspace-root> '{"tool": "<name>", <params>}'

### file.read
Read file contents with optional pagination.
Required: path (relative file path)
Optional: offset (start line, 0-based), limit (max lines)

### file.search
Search for patterns in files using ripgrep.
Required: pattern (regex)
Optional: path (directory), glob (file filter), case_sensitive (default true), context_lines, max_results (default 100)

### handoff
Hand off work to another agent and wait for completion.
Required: agentName, prompt
Optional: baseUrl, pollIntervalMs, maxWaitMs

### web.search
Search the web. This is a native tool - use it directly, not via chorus-tools.
```

Each tool entry is 2-4 lines. Only tools in the agent's `allowedTools` appear.

After the tool listings, include a note telling the agent how to get full help:

```
For detailed tool documentation including output formats, run:
chorus-tools <workspace-root> '{"tool": "help"}'
```

This lets agents self-serve if the compact descriptions aren't sufficient.

### 3. Integrate into `buildAgentSpawn`

In the `buildAgentSpawn` function, generate the tool context string and append it to the system prompt. Only do this for `UserDefinedAgent` (the existing code already branches on agent type). `InternalAgent` does not get tool context.

The system prompt assembly order becomes:
1. Agent instructions
2. Tool context section (new)
3. Completion report instruction (existing)

### 4. Source the tool descriptions from `Tools.Help`

Rather than duplicating tool descriptions, extract the data from the existing `Tools.Help` module. The `ToolHelp` type alias and individual help values (`fileReadHelp`, `handoffHelp`, etc.) contain all the necessary information.

However, `Tools.Help` currently only exposes `encodeFileToolsHelp` and `encodeAllToolsHelp` as `Encode.Value` (JSON). For generating a text string, the function needs access to the raw data. Two options:

**Option A (recommended):** Add new exports to `Tools.Help` that expose the raw `ToolHelp` records or a function that produces text from a tool name. Add a function like `toolHelpText : String -> Maybe String` that returns a compact text description for a given tool name.

**Option B:** Add a standalone function in `Main.gren` that maps tool names to compact descriptions. This duplicates some data but keeps changes localized.

The developer should use Option A to avoid duplication.

## Files to Modify

- `packages/tools/src/Tools/Help.gren` - Expose individual tool help records or add a `toolHelpText` function that returns compact text for a tool name. Expose the `ToolHelp` type alias.
- `packages/tools/src/Tools/Json.gren` - Re-export any new `Tools.Help` exports needed by Main.gren
- `packages/chorus/src/Main.gren` - Add `toolContextForAgent` function, integrate into `buildAgentSpawn` system prompt assembly for `UserDefinedAgent` only

## Related Files (reference only)

- `packages/chorus/src/Provider/ClaudeCode.gren` - Shows how `allowedTools` maps to CLI flags; `web.search` maps to `WebSearch` native tool
- `packages/chorus/src/Web/ToolExecution.gren` - Shows the full tool dispatch table and permission model; `completion-report` is auto-granted
- `packages/shared/Types.gren` - `AgentConfig` type definition (`UserDefinedAgent` vs `InternalAgent`)
- `packages/chorus/src/Agent/Registry.gren` - Default agent configs with their `allowedTools` lists
- `packages/chorus/tests/unit/ClaudeCodeTests.gren` - Existing test patterns for unit tests

## Patterns to Follow

- The existing `completionReportInstruction` string in `buildAgentSpawn` is a good pattern for how to append context to the system prompt
- `Tools.Help` uses a `ToolHelp` record type with `name`, `description`, `required`, `optional`, `output` fields - reuse this structure
- Test files follow the pattern in `ClaudeCodeTests.gren`: export a `tests` array of `{ name : String, run : Task.Task String {} }` records

## Acceptance Criteria

- [ ] User-defined agents receive a tool context section in their system prompt listing their allowed tools
- [ ] The tool context includes the chorus-tools invocation format (how to call tools via Bash)
- [ ] Each listed tool shows its name, description, and required/optional parameters in a compact format
- [ ] Only tools in the agent's `allowedTools` list appear in the context (filtered, not the full catalog)
- [ ] `completion-report` does NOT appear in the tool context section (it has its own instruction)
- [ ] `web.search` is described as a native tool (not invoked via chorus-tools)
- [ ] `handoff` is included when present in `allowedTools`, with its parameters (agentName, prompt, etc.)
- [ ] The tool context includes a note on how to get full tool help via `chorus-tools '{"tool": "help"}'`
- [ ] `InternalAgent` does NOT receive tool context (only `UserDefinedAgent`)
- [ ] Tool descriptions are sourced from `Tools.Help` (no duplication of help text)
- [ ] All existing tests pass
- [ ] Application builds successfully (`npm run build:all`)
- [ ] Unit tests cover the `toolContextForAgent` function (correct filtering, correct output format)

## Testing Requirements

- Unit test: `toolContextForAgent` with an empty allowedTools list returns empty string or no tool section
- Unit test: `toolContextForAgent` with `["file.read", "file.search"]` returns context with only those two tools
- Unit test: `toolContextForAgent` with `["web.search"]` describes it as a native tool
- Unit test: `toolContextForAgent` with `["handoff", "file.read"]` includes both tools
- Unit test: `completion-report` never appears in the output regardless of input
- Build verification: `npm run build:all` succeeds
- Test verification: `npm run test` passes

## Notes

- The `Tools.Help` module lives in `packages/tools/` which is a shared source directory referenced by the main chorus package. Changes to its exports are available to `Main.gren` via the `Tools.Json` re-export layer.
- The `ToolHelp` type alias in `Tools.Help` is not currently exported. It will need to be exported (or its data made accessible) for the text generation function.
- Tool context token budget: with ~8 tools at 2-4 lines each plus a header, the total is roughly 300-500 tokens - well within acceptable system prompt overhead.
- The `task.get` and `task.list` tools are less commonly in agent allowedTools lists today but should be handled if present.
