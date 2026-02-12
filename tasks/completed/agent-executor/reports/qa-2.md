# QA Report

## Summary

The iteration 2 fixes have been verified. Build and all tests pass. The three issues from review-1 (duplicate AgentSpec type, hardcoded file-tools path, and error classification via string parsing) have been addressed correctly. CLI behavior is consistent and provides useful error messages.

## Test Scenarios

### Scenario 1: Build and Unit Tests
- **Description:** Verify that the agent-executor and sdk-bridge build and pass all unit tests
- **Steps:**
  1. Run `npm run build` in src/agent-executor
  2. Run `npm run test` in src/agent-executor
  3. Run `npm run build` in src/sdk-bridge
  4. Run `npm run test` in src/sdk-bridge
- **Expected:** Both projects build successfully, all tests pass
- **Actual:** Agent executor: 9 tests passed. SDK bridge: 22 tests passed. Both build cleanly.
- **Status:** PASS

### Scenario 2: CLI with No Arguments
- **Description:** Verify that the CLI provides usage information when no arguments are given
- **Steps:**
  1. Run `node build/agent-executor.js`
- **Expected:** Exit code 1 with usage message in JSON format
- **Actual:** Exit code 1, outputs `{"error":"Usage: agent-executor <agent_spec> <workspace_root> [session_id]"}`
- **Status:** PASS

### Scenario 3: CLI with Valid Arguments
- **Description:** Verify that the CLI initializes correctly with valid arguments
- **Steps:**
  1. Run `node build/agent-executor.js agents/developer.md /tmp/test-workspace`
- **Expected:** JSON output with status "ready" and parsed agent name
- **Actual:** Outputs `{"status":"ready","agent_name":"Developer Agent","workspace":"/tmp/test-workspace","file_tools_path":"...","message":"Agent executor initialized..."}`
- **Status:** PASS

### Scenario 4: CLI with Optional Session ID
- **Description:** Verify that the CLI accepts the optional session_id argument
- **Steps:**
  1. Run `node build/agent-executor.js agents/developer.md /tmp/test-workspace session123`
- **Expected:** JSON output with status "ready"
- **Actual:** Successfully outputs ready status with agent details
- **Status:** PASS

### Scenario 5: CLI with Invalid Agent Spec Path
- **Description:** Verify that the CLI handles non-existent agent spec files
- **Steps:**
  1. Run `node build/agent-executor.js /nonexistent/path.md /tmp/workspace`
- **Expected:** Exit code 1 with error message
- **Actual:** Exit code 1, outputs `{"error":"Failed to read agent spec file: ENOENT: no such file or directory, open '/nonexistent/path.md'"}`
- **Status:** PASS

### Scenario 6: CLI with Missing Title in Agent Spec
- **Description:** Verify that the CLI rejects agent specs without a title
- **Steps:**
  1. Create a file without a "# Title" line
  2. Run agent-executor with that file
- **Expected:** Exit code 1 with "missing title" error
- **Actual:** Exit code 1, outputs `{"error":"Agent spec missing title: No line starting with '# ' found"}`
- **Status:** PASS

### Scenario 7: CLI with Empty System Prompt
- **Description:** Verify that the CLI rejects agent specs where there is no content between title and first section
- **Steps:**
  1. Create a file with `# Title\n\n## Section` (no content between)
  2. Run agent-executor with that file
- **Expected:** Exit code 1 with "empty system prompt" error
- **Actual:** Exit code 1, outputs `{"error":"Agent spec has empty system prompt: No content found between title and first section"}`
- **Status:** PASS

### Scenario 8: CLI with Too Many Arguments
- **Description:** Verify that the CLI rejects excess arguments
- **Steps:**
  1. Run `node build/agent-executor.js a b c d e`
- **Expected:** Exit code 1 with usage message
- **Actual:** Exit code 1, outputs usage error
- **Status:** PASS

### Scenario 9: File-tools Path Resolution from Different Directory
- **Description:** Verify that file-tools path is correctly derived from script location, not working directory
- **Steps:**
  1. Run the agent-executor from /tmp directory
- **Expected:** file_tools_path should point to location relative to the agent-executor binary
- **Actual:** file_tools_path is `/Users/david/dev/chorus/src/agent-executor/build/file-tools` regardless of working directory
- **Status:** PASS

### Scenario 10: Duplicate AgentSpec Type Removed
- **Description:** Verify that Provider.gren imports AgentSpec from Agent.Spec instead of defining it
- **Steps:**
  1. Check Provider.gren for import statement
  2. Verify no duplicate type definition exists
- **Expected:** Provider.gren imports AgentSpec from Agent.Spec
- **Actual:** Line 24 contains `import Agent.Spec exposing (AgentSpec)` and the module re-exports it
- **Status:** PASS

### Scenario 11: Error Classification Uses Structured Codes
- **Description:** Verify that error classification uses explicit error codes from TypeScript
- **Steps:**
  1. Review index.ts for ErrorCode type and classifyError function
  2. Review ClaudeCode.gren for parsePortError decoding of code field
- **Expected:** Errors include both message and code fields; Gren decodes and uses the code field
- **Actual:** TypeScript defines ErrorCode type with values (auth, rate_limit, network, session_not_found, invalid_response, unknown). createPortError adds both error and code fields. ClaudeCode.gren decodes the code field and uses it for error classification.
- **Status:** PASS

## Failures

None. All scenarios passed.

## Test Code Quality Issues

### Issue 1: Tests for sendMessage/submitToolResults don't test actual behavior
- **File:** `/Users/david/dev/chorus/src/sdk-bridge/src/client.test.ts`
- **Line:** 54-105
- **Problem:** The sendMessage and submitToolResults tests verify the response structure but not the actual behavior, since the SDK is stubbed. The tests check that response.response exists and toolCalls is an array, but don't verify the stub behavior matches expected patterns.
- **Suggestion:** Add documentation comments clarifying these tests are validating the interface structure rather than actual SDK behavior. Consider adding a test that validates the stub response message format matches documentation.

### Issue 2: Tests don't cover error code classification
- **File:** `/Users/david/dev/chorus/src/sdk-bridge/src/client.test.ts`
- **Line:** 77-84, 107-117
- **Problem:** The tests verify that invalid session IDs throw errors with "Session not found" message, but don't verify the error classification logic in classifyError. There are no tests that verify errors are classified with the correct codes.
- **Suggestion:** Add tests for the classifyError function in index.ts that verify various error message patterns are classified correctly (auth, rate_limit, network, session_not_found).

### Issue 3: Missing test for createPortError output format
- **File:** `/Users/david/dev/chorus/src/sdk-bridge/src/index.ts`
- **Line:** 179-186
- **Problem:** The createPortError function produces JSON with specific structure that Gren depends on. There are no tests verifying this format is correct.
- **Suggestion:** Add a unit test that verifies createPortError returns an Error whose message is valid JSON containing both "error" and "code" fields.

### Issue 4: Gren tests use Expect.fail for Err cases without checking error type
- **File:** `/Users/david/dev/chorus/src/agent-executor/tests/unit/SpecTests.gren`
- **Line:** 36-39, 57-60
- **Problem:** Several tests have Ok branches that fail with `Expect.fail (Spec.parseErrorToString err)` but don't validate what specific error was expected. While the test name indicates what should happen, validating the error type would make failures more informative.
- **Suggestion:** The test pattern is acceptable for success cases, but could be improved by adding an Err pattern that verifies it was actually an unexpected error type if one occurs.

### Issue 5: submitToolResults test lacks assertion on behavior
- **File:** `/Users/david/dev/chorus/src/sdk-bridge/src/client.test.ts`
- **Line:** 87-105
- **Problem:** The test "should accept tool results for a valid session" sends a message first, then submits tool results, but doesn't verify the tool results were actually associated with the message. The assertion only checks that response exists and toolCalls is an array.
- **Suggestion:** Add assertions that verify the stub response acknowledges receiving the expected number of tool results, or verify the session state was updated correctly.

## Integration Tests Added

No integration tests were added for the agent-executor as the QA instructions indicate that integration tests follow the file-tools pattern (`src/tools/tests/integration/{tool-name}.json`). The agent-executor requires live SDK calls which are not available for testing.

| Test Name | File | Validates |
|-----------|------|-----------|
| N/A | N/A | Agent-executor requires Claude Code SDK authentication which cannot be tested without live credentials |

The existing unit tests in both Gren (9 tests for spec parsing) and TypeScript (22 tests for client and tools) provide adequate coverage for the components that can be tested in isolation.

## Overall Assessment

**Decision:** PASS

The iteration 2 changes correctly address all three issues identified in the review:

1. **Duplicate AgentSpec type (BLOCKING)** - Resolved. Provider.gren now imports AgentSpec from Agent.Spec and re-exports it.

2. **Hardcoded file-tools path (HIGH PRIORITY)** - Resolved. The getFileToolsPath function derives the path from the script location. The path is included in the output for visibility.

3. **Error classification via string parsing (SUGGESTION)** - Resolved. TypeScript now classifies errors and includes an explicit code field. Gren decodes and uses this code for error type classification.

Build passes, all 31 tests pass (9 Gren + 22 TypeScript), and CLI behavior is correct for all tested scenarios.

Non-blocking observations:
- The test code quality issues identified above could be addressed in future iterations
- The handlePortResponse function remains unused (noted in review-2)
- Empty system prompt on session resume remains (noted in review-2)
- These are minor concerns that don't block the current changes
