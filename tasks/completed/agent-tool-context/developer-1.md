# Developer Report

## Task
Add a tool context section to the system prompt of user-defined agents so they know what chorus-tools are available and how to invoke them. The tool context is generated from the existing `Tools.Help` data, filtered to the agent's `allowedTools` list, and inserted between the agent instructions and the completion-report instruction.

## Files Modified
- `packages/tools/src/Tools/Help.gren` - Exported `ToolHelp` type alias and added `toolHelpByName` lookup function. Refactored tool help entries to separate `ToolHelp` records from `Encode.Value` functions. Added help entries for `task.get`, `task.list`, and `web.search`.
- `packages/tools/src/Tools/Json.gren` - Re-exported `ToolHelp` type alias and `toolHelpByName` function from `Tools.Help`.
- `packages/chorus/src/Agent/ToolContext.gren` - New module containing `toolContextForAgent` function that generates compact tool context text from an array of allowed tool names.
- `packages/chorus/src/Main.gren` - Imported `Agent.ToolContext` and integrated `toolContextForAgent` into `buildAgentSpawn`. Tool context is generated for `UserDefinedAgent` only (empty string for `InternalAgent`). System prompt assembly order is now: agent instructions, tool context, completion-report instruction.
- `packages/chorus/tests/unit/ToolContextTests.gren` - New test module with 9 unit tests covering all specified test scenarios.
- `packages/chorus/tests/unit/TestRunner.gren` - Registered `ToolContextTests` in the test runner.
- `packages/chorus/tests/unit/gren.json` - Added `../../../tools/src` to source-directories so tests can access `Tools.Help`.

## Build Status
**Status:** PASS

```
Success! Compiled 23 modules.
    Main ───> build/chorus-tmp
dist/ assembled.
```

## Test Status
**Status:** PASS

```
Running 77 tests...
77 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes
- Created a separate `Agent.ToolContext` module rather than keeping the function in `Main.gren`. `Main.gren` is an application module that cannot be imported by test modules, so extracting the logic into its own module enables unit testing.
- The `toolContextForAgent` function filters out `completion-report` (which has its own dedicated instruction) and empty strings from the input tool names.
- Unknown tool names (not found in `Tools.Help`) are silently ignored, producing no entry in the output.
- `web.search` gets a special "native tool" note appended to its entry, explaining it should be used directly rather than via chorus-tools.
- Added `task.get`, `task.list`, and `web.search` help records to `Tools.Help` to complete the tool catalog. These were missing from the help system but are referenced by agent configs.
- Each tool help entry in `Tools.Help` was refactored from being an `Encode.Value` directly to having a separate `ToolHelp` record (e.g., `fileReadHelpRecord`) with the `Encode.Value` version (e.g., `fileReadHelp`) calling `encodeTool` on the record. This avoids duplicating descriptions.
- The `allToolHelp` array and `toolHelpByName` function are internal to `Tools.Help`, with `toolHelpByName` being the public API for looking up tool help by name.

## Iteration
1
