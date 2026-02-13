# QA Report

## Summary
All three parts of the implementation (tool name mapping, dead binary removal, server-side handoff) build and pass automated tests. The core logic is correct and well-tested. One issue found: the `packages/tools/package.json` still references deleted entry points in its `build` and `test:integration` scripts.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Build all components with `npm run build:all`
- **Steps:**
  1. Run `npm run build:all` in the worktree
- **Expected:** All three build phases (UI, tools, chorus) succeed
- **Actual:** UI compiled 13 modules, tools compiled 5 modules (only chorus-tools), chorus compiled 22 modules. Dist assembled.
- **Status:** PASS

### Scenario 2: All unit tests pass
- **Description:** Run unit test suite
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** All 68 tests pass including new chorusToolsToCliFlags tests
- **Actual:** 68 passed, 0 failed
- **Status:** PASS

### Scenario 3: All integration tests pass
- **Description:** Run integration test suite
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** All 19 integration tests pass
- **Actual:** 19 passed, 0 failed
- **Status:** PASS

### Scenario 4: Tool name mapping - file tools map to Bash
- **Description:** Verify file.read and file.write map to Bash CLI flag
- **Steps:**
  1. Review unit test `testChorusToolsMapsFileReadWrite`
  2. Verify `chorusToolsToCliFlags "./tools/chorus-tools" "file.read file.write"` produces `{ tools = "Bash", allowedTools = "Bash(./tools/chorus-tools *)" }`
- **Expected:** Both file tools deduplicate to a single Bash entry
- **Actual:** Test passes, both `tools` and `allowedTools` match expected values
- **Status:** PASS

### Scenario 5: Tool name mapping - web.search maps to WebSearch
- **Description:** Verify web.search maps to WebSearch CLI flag
- **Steps:**
  1. Review unit test `testChorusToolsMapsWebSearch`
  2. Verify `chorusToolsToCliFlags "./tools/chorus-tools" "web.search"` produces `{ tools = "WebSearch", allowedTools = "WebSearch" }`
- **Expected:** WebSearch is correctly mapped
- **Actual:** Test passes
- **Status:** PASS

### Scenario 6: Tool name mapping - mixed tools
- **Description:** Verify file.read + web.search produces both Bash and WebSearch
- **Steps:**
  1. Review unit test `testChorusToolsMapsFileReadAndWebSearch`
  2. Verify result is `{ tools = "Bash WebSearch", allowedTools = "Bash(./tools/chorus-tools *) WebSearch" }`
- **Expected:** Both tool categories present
- **Actual:** Test passes
- **Status:** PASS

### Scenario 7: Tool name mapping - handoff deduplicates with file tools
- **Description:** Verify handoff + file.read maps to a single Bash entry
- **Steps:**
  1. Review unit test `testChorusToolsMapsHandoffAndFileRead`
  2. Verify `chorusToolsToCliFlags "./tools/chorus-tools" "handoff file.read"` produces `{ tools = "Bash", allowedTools = "Bash(./tools/chorus-tools *)" }`
- **Expected:** Both map to Bash, deduplicated to one entry
- **Actual:** Test passes
- **Status:** PASS

### Scenario 8: Tool name mapping - empty input falls back to Bash
- **Description:** Verify empty tool list falls back to Bash
- **Steps:**
  1. Review unit test `testChorusToolsEmptyFallsBackToBash`
- **Expected:** Fallback to Bash(chorusToolsPath *)
- **Actual:** Test passes
- **Status:** PASS

### Scenario 9: Tool name mapping - unrecognized names ignored
- **Description:** Verify unknown tool names are silently ignored, not passed through
- **Steps:**
  1. Review unit test `testChorusToolsIgnoresUnrecognized`
  2. Input "unknown.tool" should produce fallback Bash
- **Expected:** Unknown tool is dropped, falls back to Bash
- **Actual:** Test passes
- **Status:** PASS

### Scenario 10: Dead files are deleted
- **Description:** Verify all dead entry points and unused modules are removed
- **Steps:**
  1. Check that FileToolsMain.gren, HandoffMain.gren, TaskToolsMain.gren, CombinedMain.gren are deleted
  2. Check that Tools/Cli.gren, Tools/TaskJson.gren, Tools/TaskStatus.gren, Tools/Handoff.gren are deleted
  3. Check no dangling references remain in surviving code
- **Expected:** All 8 files deleted, no references to deleted modules
- **Actual:** All 8 files confirmed missing. Grep for `Tools.Handoff`, `Tools.Cli`, `Tools.TaskJson`, `Tools.TaskStatus` across the tools package returns no matches. Grep for `HandoffRequest`, `encodeHandoffOutput`, `handoffInputDecoder` across all packages returns no matches.
- **Status:** PASS

### Scenario 11: Preserved modules are intact
- **Description:** Verify Tools.File, Tools.Json, Tools.Validation, Tools.Help are preserved
- **Steps:**
  1. List remaining files in packages/tools/src/Tools/
- **Expected:** File.gren, Json.gren, Validation.gren, Help.gren present
- **Actual:** Exactly those 4 files remain
- **Status:** PASS

### Scenario 12: Tools.Json no longer depends on Tools.Handoff
- **Description:** Verify HandoffRequest variant and related code removed from Tools.Json
- **Steps:**
  1. Read packages/tools/src/Tools/Json.gren
  2. Verify no `import Tools.Handoff`, no `HandoffRequest`, no `encodeHandoffOutput`, no `handoffInputDecoder`
- **Expected:** All handoff-related code removed
- **Actual:** ToolRequest type has only ReadRequest, CreateRequest, WriteRequest, PatchRequest, DeleteRequest, ListRequest, SearchRequest, HelpRequest. No handoff imports or types.
- **Status:** PASS

### Scenario 13: ChorusToolsMain is a pure proxy
- **Description:** Verify all tools are forwarded to server with no special cases
- **Steps:**
  1. Read packages/tools/src/ChorusToolsMain.gren
  2. Verify dispatchTool just calls forwardToServer
  3. Verify no `Tools.Handoff` import
- **Expected:** Pure proxy, no tool-specific logic
- **Actual:** `dispatchTool` directly calls `forwardToServer`. No special-case branching. Only imports are `Tools.Json` (for error encoding) and standard libraries.
- **Status:** PASS

### Scenario 14: build:tools script simplified
- **Description:** Verify package.json build:tools only compiles chorus-tools
- **Steps:**
  1. Check root package.json build:tools script
- **Expected:** Only ChorusToolsMain compilation
- **Actual:** Script is `cd packages/tools && gren make ChorusToolsMain --output=build/chorus-tools-tmp && ...`
- **Status:** PASS

### Scenario 15: Server handles handoff tool via DeferredHandoff
- **Description:** Verify ToolExecution dispatches handoff as DeferredHandoff
- **Steps:**
  1. Read packages/chorus/src/Web/ToolExecution.gren
  2. Verify `dispatchHandoffTool` returns `DeferredHandoff` with agentName and prompt
- **Expected:** Handoff requests produce DeferredHandoff ApiResult
- **Actual:** `dispatchHandoffTool` parses agentName and prompt, returns `DeferredHandoff { agentName, prompt }`. Error handling for missing fields returns 400.
- **Status:** PASS

### Scenario 16: Main.gren handles DeferredHandoff lifecycle
- **Description:** Verify Main.gren has the full deferred handoff flow
- **Steps:**
  1. Verify `pendingHandoffResponses` field in Model
  2. Verify `GotDeferredHandoffLookup` and `GotDeferredHandoffStarted` message variants
  3. Verify `GotAgentComplete` checks for and resolves pending deferred responses
  4. Verify DeferredHandoff is handled in all ApiResult pattern matches
- **Expected:** Complete server-side handoff lifecycle
- **Actual:** All four elements present. `pendingHandoffResponses` is a `Dict String Response`. `GotToolResult` intercepts `DeferredHandoff` and initiates the agent lookup -> start handoff -> spawn agent flow. `GotAgentComplete` resolves pending responses by sending the agent output back through the held HTTP response.
- **Status:** PASS

### Scenario 17: App starts and serves requests
- **Description:** Start the app and verify basic API functionality
- **Steps:**
  1. Run `npm run start`
  2. Create a workspace config
  3. Create a task
  4. Test chorus-tools binary via direct execution
- **Expected:** App starts, accepts requests, chorus-tools forwards to server
- **Actual:** App started on port 8080. Config creation succeeded. Task creation returned a valid task ID. Running `chorus-tools '{"tool":"help"}'` correctly forwarded to the server (returned expected "No agent currently active" error since no agent was running on the task).
- **Status:** PASS

### Scenario 18: Handoff REST API endpoint still works
- **Description:** Verify POST /api/tasks/:id/handoff still works for non-tool callers
- **Steps:**
  1. Create a task
  2. Create an agent config
  3. Call POST /api/tasks/:id/handoff
- **Expected:** Endpoint is functional (failure due to provider not being configured is acceptable)
- **Actual:** Returns 409 CONFLICT with "System agent provider is not configured" - the endpoint correctly found the agent and attempted to start the handoff, failing at the provider level. This confirms the existing handoff API endpoint continues to work.
- **Status:** PASS

## Failures

### Failure 1: packages/tools/package.json still references deleted binaries
- **Scenario:** N/A (discovered during code review)
- **Reproduction Steps:**
  1. Open `packages/tools/package.json`
  2. Observe that the `build` script still references `FileToolsMain`, `HandoffMain`, `TaskToolsMain`
  3. Observe that `test:integration` script still references `build/file-tools`, `build/handoff-tool`, `build/task-tools`
- **Expected Behavior:** Scripts should be updated to only reference ChorusToolsMain and chorus-tools binary
- **Actual Behavior:** Old references remain. Running `cd packages/tools && npm run build` or `cd packages/tools && npm run test:integration` will fail because the source files and binaries no longer exist.
- **Severity:** MINOR

Note: This does not block the top-level `npm run test` or `npm run build:all` because those use the root package.json scripts, which were correctly updated. The affected scripts are only in the tools sub-package's own `package.json`.

### Failure 2: Old handoff/task-tools integration test fixtures still exist
- **Scenario:** N/A (discovered during code review)
- **Reproduction Steps:**
  1. Check `packages/tools/tests/integration/handoff-tool/` and `packages/tools/tests/integration/task-tools/`
  2. These directories contain test scenarios referencing the old standalone handoff-tool and task-tools binaries
- **Expected Behavior:** These test directories should be removed since the binaries they test no longer exist
- **Actual Behavior:** Test fixtures remain for non-existent binaries
- **Severity:** MINOR

## Test Code Quality Issues

### Issue 1: Tests verify both fields but chain assertions
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 1193-1268 (all chorusToolsToCliFlags tests)
- **Problem:** Each test verifies both `tools` and `allowedTools` by chaining two assertions with `Task.andThen`. This means if the first assertion fails, the second is never checked. While acceptable in Gren's test pattern, it means a failure only reports the first mismatch.
- **Suggestion:** This is a minor concern. The current approach is consistent with the existing test patterns in the file. No change required.

### Issue 2: No test for all file tool names
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Problem:** The tests cover file.read, file.write, and handoff, but not file.create, file.patch, file.delete, file.list, or file.search individually. While they all map to the same Bash value, a regression in any individual mapping would not be caught.
- **Suggestion:** Consider adding a test that passes all file tool names to verify comprehensive coverage: `"file.read file.write file.create file.patch file.delete file.list file.search handoff"` should produce a single Bash entry.

## Integration Tests Added

No integration tests were added to the `packages/tools/tests/integration/` directory because:
1. The tool name mapping is a compile-time function in the chorus package (not a runtime tool operation), and is tested by unit tests.
2. The existing integration test framework tests tool input/output through standalone binaries, but the tool binary is now a pure proxy - its behavior depends on the server, making the existing framework unsuitable.
3. The deferred handoff server-side flow requires a running Chorus server with configured providers and agents, which exceeds the scope of the standalone binary integration test framework.

Manual testing confirmed the app starts, the chorus-tools binary correctly forwards requests to the server, and the handoff REST API endpoint continues to function.

## Overall Assessment

**Decision:** PASS

The implementation correctly addresses all three parts of the task:
1. Tool name mapping works correctly, preventing Claude CLI from getting access to internal tools like Task, Edit, Write, etc.
2. Dead tool binaries and unused modules are properly cleaned up.
3. The handoff special case is removed from the tool binary; the server now handles the full handoff lifecycle.

Non-blocking observations:
- The `packages/tools/package.json` `build` and `test:integration` scripts still reference deleted binaries. These should be updated or removed to prevent confusion when running tools-specific commands.
- The old integration test fixtures for handoff-tool and task-tools should be removed since those binaries no longer exist.
- Consider adding a comprehensive test that maps all recognized Chorus tool names at once.
