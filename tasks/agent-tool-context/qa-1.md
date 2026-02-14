# QA Report

## Summary

The agent tool context feature is implemented correctly and all acceptance criteria are met. The build succeeds (23 modules), all 77 unit tests and 19 integration tests pass, and the application starts and serves its UI without errors. The 9 new unit tests cover the specified scenarios comprehensively. One minor non-blocking issue was identified (redundant native-tool messaging for `web.search`), which was also flagged in the code review.

## Test Scenarios

### Scenario 1: Build verification
- **Description:** Build the entire application to verify compilation succeeds
- **Steps:**
  1. Run `npm run build:dist` in the worktree
- **Expected:** Build completes with 23 compiled modules and no errors
- **Actual:** Build completed successfully: "Success! Compiled 23 modules." and "dist/ assembled."
- **Status:** PASS

### Scenario 2: Unit test suite passes
- **Description:** Run all unit tests including the 9 new ToolContext tests
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** All 77 unit tests pass (68 existing + 9 new)
- **Actual:** "77 passed, 0 failed"
- **Status:** PASS

### Scenario 3: Integration test suite passes
- **Description:** Run all integration tests to verify no regressions
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** All 19 integration tests pass
- **Actual:** "19 passed, 0 failed"
- **Status:** PASS

### Scenario 4: Application starts and serves UI
- **Description:** Start the application and verify it serves the web UI
- **Steps:**
  1. Run `npm run start`
  2. Open browser to http://localhost:8080
  3. Create a workspace pointing to the worktree directory
  4. Navigate to Agents page
- **Expected:** UI loads, workspace creation works, agents listed with their allowed tools
- **Actual:** UI loaded correctly. Workspace creation succeeded. Agents page showed all agents with their allowed tools (e.g., writer-workflow: handoff, file.read, file.list, file.search; fact-checker: file.read, file.list, file.search, web.search).
- **Status:** PASS

### Scenario 5: API returns agent data with allowedTools
- **Description:** Verify the API returns agent configuration including their tool lists
- **Steps:**
  1. Call `curl http://localhost:8080/api/agents`
- **Expected:** JSON response with all agents, each showing their `allowedTools` array
- **Actual:** API returned all 7 agents (6 user-defined + 1 internal) with correct `allowedTools` arrays matching the registry configuration
- **Status:** PASS

### Scenario 6: Empty allowedTools returns empty string (unit test verification)
- **Description:** `toolContextForAgent` with empty array returns empty string
- **Steps:**
  1. Unit test `testEmptyAllowedToolsReturnsEmptyString` calls `toolContextForAgent []`
- **Expected:** Returns `""`
- **Actual:** Test passes, returns `""`
- **Status:** PASS

### Scenario 7: Filtering to only requested tools (unit test verification)
- **Description:** `toolContextForAgent ["file.read", "file.search"]` returns only those tools
- **Steps:**
  1. Unit test `testFileReadAndFileSearchReturnsOnlyThoseTools` asserts presence of `### file.read` and `### file.search`, and absence of `### file.write`, `### file.create`, `### handoff`, `### web.search`
- **Expected:** Only the two requested tools appear in output
- **Actual:** Test passes
- **Status:** PASS

### Scenario 8: web.search described as native tool (unit test verification)
- **Description:** `toolContextForAgent ["web.search"]` includes native tool description
- **Steps:**
  1. Unit test `testWebSearchDescribedAsNativeTool` checks for `### web.search`, `native tool`, and `not via chorus-tools`
- **Expected:** web.search section includes native tool notation
- **Actual:** Test passes
- **Status:** PASS

### Scenario 9: handoff parameters included (unit test verification)
- **Description:** `toolContextForAgent ["handoff", "file.read"]` includes handoff with its parameters
- **Steps:**
  1. Unit test `testHandoffAndFileReadIncludesBoth` checks for `### handoff`, `### file.read`, `agentName`, and `prompt`
- **Expected:** Both tools present, handoff shows its required parameters
- **Actual:** Test passes
- **Status:** PASS

### Scenario 10: completion-report filtered out (unit test verification)
- **Description:** `completion-report` is excluded from the tool context regardless of input
- **Steps:**
  1. Unit test `testCompletionReportNeverAppears` calls with `["completion-report"]` only
  2. Unit test `testCompletionReportWithOtherToolsFiltered` calls with `["completion-report", "file.read"]`
- **Expected:** First returns empty string; second includes file.read but not completion-report
- **Actual:** Both tests pass
- **Status:** PASS

### Scenario 11: Invocation format and help note included (unit test verification)
- **Description:** Output includes the chorus-tools invocation format and help note
- **Steps:**
  1. Unit test `testIncludesInvocationFormat` checks for `chorus-tools <workspace-root>` and `{"tool": "<name>"`
  2. Unit test `testIncludesHelpNote` checks for `{"tool": "help"}`
- **Expected:** Both the invocation format header and help note footer are present
- **Actual:** Both tests pass
- **Status:** PASS

### Scenario 12: Unknown tools silently ignored (unit test verification)
- **Description:** `toolContextForAgent ["unknown.tool"]` returns empty string
- **Steps:**
  1. Unit test `testUnknownToolsIgnored` calls with `["unknown.tool"]`
- **Expected:** Returns `""`
- **Actual:** Test passes
- **Status:** PASS

### Scenario 13: InternalAgent does not receive tool context (code review)
- **Description:** Verify that `InternalAgent` gets empty tool context in `buildAgentSpawn`
- **Steps:**
  1. Read Main.gren lines 485-491
- **Expected:** `toolContext` is `""` for `InternalAgent _`
- **Actual:** Code correctly returns `""` for `InternalAgent _` and calls `toolContextForAgent r.allowedTools` for `UserDefinedAgent r`
- **Status:** PASS

### Scenario 14: Tool descriptions sourced from Tools.Help (code review)
- **Description:** Verify tool descriptions come from `Tools.Help`, not duplicated
- **Steps:**
  1. Read `Agent/ToolContext.gren` -- imports `Tools.Help as ToolHelp`
  2. Read `Tools/Help.gren` -- `toolHelpByName` looks up from `allToolHelp` array
  3. Verify `toolHelpToText` uses the `ToolHelp` record's `.description`, `.required`, `.optional` fields
- **Expected:** All tool data comes from `Tools.Help` records
- **Actual:** Confirmed. `toolHelpToText` uses `tool.description`, `tool.required`, `tool.optional` directly from the `ToolHelp` record. No duplication of help text.
- **Status:** PASS

### Scenario 15: System prompt assembly order (code review)
- **Description:** Verify the system prompt is assembled in the correct order
- **Steps:**
  1. Read Main.gren lines 496-500
- **Expected:** Order: agent instructions + tool context + completion report instruction
- **Actual:** `systemPrompt = Just (agentInstructions ++ toolContext ++ completionReportInstruction)` -- correct order
- **Status:** PASS

## Failures

No failures.

## Test Code Quality Issues

### Issue 1: Multiple assertions per test in filtering test
- **File:** `packages/chorus/tests/unit/ToolContextTests.gren`
- **Line:** 72-86
- **Problem:** `testFileReadAndFileSearchReturnsOnlyThoseTools` chains 6 assertions (2 positive + 4 negative) in a single test. While all assertions are logically related (verifying filtering), a failure in the first assertion would mask the others.
- **Suggestion:** This is acceptable given the Gren test framework's constraints (no built-in test grouping). The chained `Task.andThen` pattern is the standard approach in this codebase. The test name accurately describes what is being verified.

### Issue 2: Redundant native-tool note for web.search
- **File:** `packages/tools/src/Tools/Help.gren` (line 302) and `packages/chorus/src/Agent/ToolContext.gren` (lines 82-86)
- **Problem:** The `webSearchHelpRecord.description` already says "This is a native Claude tool - use it directly, not via chorus-tools." Then `toolHelpToText` appends an additional note: "Note: This is a native tool - use it directly, not via chorus-tools." The generated output for web.search will contain this information twice.
- **Suggestion:** Remove the native-tool language from `webSearchHelpRecord.description` (change to "Search the web") and let the `nativeNote` in `toolHelpToText` be the sole source of the native-tool explanation. This keeps help records focused on describing what tools do, with invocation-specific notes handled by `ToolContext`.

### Issue 3: `expectTrue` helper defined but unused
- **File:** `packages/chorus/tests/unit/ToolContextTests.gren`
- **Line:** 36-41
- **Problem:** The `expectTrue` helper function is defined but never used in any test.
- **Suggestion:** Remove the unused helper to keep the test file clean.

## Integration Tests Added

No new integration tests were added because the tool context feature is purely a system-prompt generation function with no external I/O or tool execution. The feature is tested through 9 unit tests that verify the pure function `toolContextForAgent`. Integration testing would require spawning an actual agent with a configured provider, which tests prompt content indirectly at best. The unit test coverage is appropriate for this feature.

| Test Name | File | Validates |
|---|---|---|
| Empty allowedTools returns empty string | `ToolContextTests.gren` | Empty input produces empty output |
| file.read and file.search returns only those tools | `ToolContextTests.gren` | Filtering works -- only requested tools appear |
| web.search described as native tool | `ToolContextTests.gren` | Native tool notation is present |
| handoff and file.read includes both | `ToolContextTests.gren` | Multiple tools work, handoff params included |
| completion-report never appears | `ToolContextTests.gren` | Filtering excludes completion-report alone |
| completion-report filtered with other tools | `ToolContextTests.gren` | Filtering excludes completion-report alongside valid tools |
| Includes invocation format | `ToolContextTests.gren` | Header contains chorus-tools invocation pattern |
| Includes help note | `ToolContextTests.gren` | Footer contains help tool invocation |
| Unknown tools ignored | `ToolContextTests.gren` | Unrecognized tool names produce empty output |

## Overall Assessment

**Decision:** PASS

All acceptance criteria from the task specification are satisfied:
- User-defined agents receive a tool context section in their system prompt
- The tool context includes the chorus-tools invocation format
- Each listed tool shows its name, description, and required/optional parameters
- Only tools in the agent's `allowedTools` list appear (filtered)
- `completion-report` does NOT appear in the tool context section
- `web.search` is described as a native tool
- `handoff` is included with its parameters when present in `allowedTools`
- The tool context includes a help note for full documentation
- `InternalAgent` does NOT receive tool context
- Tool descriptions are sourced from `Tools.Help` (no duplication)
- All existing tests pass (77 unit + 19 integration)
- Application builds successfully
- Unit tests cover the `toolContextForAgent` function comprehensively (9 tests)

Non-blocking observations:
- The `web.search` native-tool message appears twice in the generated output (once in the description from `Tools.Help`, once from the `nativeNote` logic in `ToolContext`). This was also flagged in the code review. It is cosmetic and does not affect functionality.
- The `expectTrue` test helper is unused and can be removed.
