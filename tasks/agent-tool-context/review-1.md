# Code Review Report

## Summary

The implementation is clean and well-structured, correctly adding tool context to user-defined agent system prompts. There is one substantive issue: the `web.search` tool description contains redundant "native tool" messaging that will appear twice in the generated output.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Redundant native-tool note for web.search
- **File:** `packages/tools/src/Tools/Help.gren` and `packages/chorus/src/Agent/ToolContext.gren`
- **Line:** Help.gren:302, ToolContext.gren:82-86
- **Category:** Duplication
- **Description:** The `webSearchHelpRecord` description already says "This is a native Claude tool - use it directly, not via chorus-tools." Then `toolHelpToText` appends an additional `nativeNote` saying "Note: This is a native tool - use it directly, not via chorus-tools." The result for `web.search` will contain this information twice: once in the description line and again as a separate note line.
- **Suggestion:** Either (a) remove the native-tool language from `webSearchHelpRecord.description` so it simply reads "Search the web" and let the `nativeNote` in `toolHelpToText` be the sole source of the native-tool explanation, or (b) remove the `nativeNote` logic from `toolHelpToText` and rely on the description. Option (a) is preferred because it keeps `webSearchHelpRecord` consistent with other help records (description describes what the tool does, not how to invoke it) and keeps the invocation-specific logic in `ToolContext`.

#### Suggestion 2: Unused `toolName` parameter duplicates `tool.name`
- **File:** `packages/chorus/src/Agent/ToolContext.gren`
- **Line:** 56
- **Category:** Simplification
- **Description:** `toolHelpToText` takes both `toolName : String` (from the `allowedTools` list) and `tool : ToolHelp` (which has a `.name` field). These will always be the same string since the tool was looked up by that exact name. The function uses `toolName` only for the `web.search` check and `tool.name` for the heading -- having two sources for the same value is slightly confusing.
- **Suggestion:** Remove the `toolName` parameter and use `tool.name` throughout: `toolHelpToText : ToolHelp.ToolHelp -> String`. The call site becomes `Maybe.map toolHelpToText` instead of `Maybe.map (toolHelpToText name)`.

#### Suggestion 3: `encodeAllToolsHelp` is now out of sync with `allToolHelp`
- **File:** `packages/tools/src/Tools/Help.gren`
- **Line:** 39-55 vs 73-86
- **Category:** Naming
- **Description:** `encodeAllToolsHelp` encodes 8 tools (file tools + handoff) while `allToolHelp` contains 11 tools (file tools + handoff + task.get + task.list + web.search). The name `encodeAllToolsHelp` is now misleading -- it does not encode "all" tools; it encodes the tools available through the chorus-tools binary. Meanwhile `allToolHelp` genuinely contains all tools. Someone reading the module could be confused about which "all" means what.
- **Suggestion:** Consider renaming `encodeAllToolsHelp` to `encodeChorusToolsHelp` or `encodeBinaryToolsHelp` to make the distinction explicit. This is a minor naming clarity issue, not urgent.

#### Suggestion 4: Leading whitespace in tool context when agent instructions are empty
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 497-500
- **Category:** Correctness
- **Description:** When `agentInstructions` is empty, `systemPrompt` becomes `Just (toolContext ++ completionReportInstruction)`. Since `toolContext` begins with `"\n\n## Available Tools\n..."`, the system prompt starts with two leading newlines. This is functionally harmless (LLMs handle leading whitespace fine) but is slightly untidy.
- **Suggestion:** No change required unless you want a perfectly trimmed system prompt. If desired, `String.trimLeft` could be applied to the final assembled string.

## Overall Assessment

**Decision:** APPROVED

The implementation satisfies all acceptance criteria from the task specification. Tool context is generated from `Tools.Help` data, filtered to the agent's `allowedTools`, excludes `completion-report`, handles `web.search` as a native tool, includes the invocation format and help note, and only applies to `UserDefinedAgent`. The new `Agent.ToolContext` module is a good design choice for testability. All 9 unit tests cover the specified scenarios comprehensively, and both the build (23 modules) and test suite (77 unit + 19 integration) pass cleanly. The suggestions above are worth considering -- especially the `web.search` redundant description (Suggestion 1) -- but none are blocking.
