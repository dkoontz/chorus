# Task: Implement Help Display for File Tools

## Summary

The file-tools binary currently shows only a generic usage line (`Usage: file-tools <workspace_root> <json_input>`) when invoked incorrectly. There is no way for an agent to discover what commands are available, what parameters each command expects, or what output it will receive. Implement a `help` tool that returns structured help information.

## Requirements

- Add a `help` tool request that returns structured information about all available commands
- Help output must include: command name, description, required parameters, optional parameters, and output fields
- When the binary is invoked with no arguments or invalid arguments, the error message should mention the `help` tool so agents know it exists
- Help output must be JSON (consistent with all other tool responses)

## Acceptance Criteria

- [ ] Sending `{"tool":"help"}` returns JSON describing all available file tools
- [ ] Each tool entry includes: name, description, parameters (with required/optional distinction), and output schema
- [ ] The usage error message references the help tool (e.g., `Use {"tool":"help"} for available commands`)
- [ ] Help text is accurate and matches actual tool behavior
- [ ] The help tool works in both `file-tools` and `main` binaries
- [ ] Integration tests verify the help output

## Technical Context

**Affected files:**
- `packages/tools/src/Tools/Json.gren` - Add `HelpRequest` to `ToolRequest` type, add decoder for `"help"` tool name
- `packages/tools/src/FileToolsMain.gren` - Handle `HelpRequest` in `executeRequest`
- `packages/tools/src/Main.gren` - Handle `HelpRequest` in `executeRequest`
- `packages/tools/src/Tools/Help.gren` (new) - Help text content and JSON encoder

**Pattern:** Follow existing tool patterns - add a variant to `ToolRequest`, add a decoder case in `toolDecoder`, handle in `executeRequest`, encode output as JSON.

## Example Output

```json
{
  "tools": [
    {
      "name": "file.read",
      "description": "Read file contents with optional pagination",
      "parameters": {
        "required": {
          "path": "Relative path to the file to read"
        },
        "optional": {
          "offset": "Line number to start reading from (1-based)",
          "limit": "Maximum number of lines to return"
        }
      },
      "output": {
        "content": "File contents with line numbers",
        "total_lines": "Total number of lines in the file",
        "truncated": "Whether the output was truncated"
      }
    }
  ]
}
```
