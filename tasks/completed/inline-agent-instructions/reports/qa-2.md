# QA Report

## Summary

All four fixes from iteration 2 have been verified. The blocking issue (duplicate agent creation returning 409 Conflict) is correctly implemented. The three non-blocking suggestions (getAgent refactor, decoder strictness, sendBadRequest JSON escaping) are all working as specified. Build passes, all 46 tests pass, and manual API and UI testing confirm correct behavior. Overall assessment: PASS.

## Test Scenarios

### Scenario 1: Duplicate agent creation returns 409 Conflict
- **Description:** POST /api/agents with an agent name that already exists should return 409
- **Steps:**
  1. GET /api/agents to confirm "developer" agent exists
  2. POST /api/agents with name "developer"
  3. Check HTTP status code
- **Expected:** 409 Conflict with message "Agent already exists: developer"
- **Actual:** 409 Conflict returned with `{"error":{"code":"CONFLICT","message":"Agent already exists: developer"}}`
- **Status:** PASS

### Scenario 2: New agent creation succeeds
- **Description:** POST /api/agents with a new name should succeed with 201
- **Steps:**
  1. POST /api/agents with name "test-agent"
  2. Check HTTP status code and response body
- **Expected:** 201 Created with the agent config in the response
- **Actual:** 201 returned with correct agent config JSON
- **Status:** PASS

### Scenario 3: Creating same new agent twice returns 409 on second attempt
- **Description:** After creating a new agent, attempting to create it again should return 409
- **Steps:**
  1. POST /api/agents with name "test-agent" (already created in scenario 2)
  2. Check HTTP status code
- **Expected:** 409 Conflict
- **Actual:** 409 Conflict returned
- **Status:** PASS

### Scenario 4: Backward-compatible decoder accepts old specPath format
- **Description:** POST /api/agents with old-style JSON containing specPath instead of instructions
- **Steps:**
  1. POST /api/agents with `{"name":"old-format-agent","specPath":"agents/old-format.md","allowedTools":"Bash","permissionMode":"default"}`
  2. Check response body
- **Expected:** Agent created with empty instructions
- **Actual:** 201 returned with `"instructions": ""`
- **Status:** PASS

### Scenario 5: Decoder rejects JSON with neither instructions nor specPath
- **Description:** POST /api/agents with JSON missing both instructions and specPath should fail
- **Steps:**
  1. POST /api/agents with `{"name":"no-instructions-agent","allowedTools":"Bash","permissionMode":"default"}`
  2. Check response
- **Expected:** 400 Bad Request
- **Actual:** 400 returned with `{"error":{"code":"BAD_REQUEST","message":"Invalid JSON body for agent config"}}`
- **Status:** PASS

### Scenario 6: sendBadRequest produces valid JSON
- **Description:** Sending malformed JSON to a POST endpoint should return a valid JSON error response
- **Steps:**
  1. POST /api/tasks with body `this is not json "with quotes"`
  2. Parse response with jq
- **Expected:** Valid JSON error response
- **Actual:** Valid JSON: `{"error":{"code":"BAD_REQUEST","message":"Invalid JSON body for task creation"}}`
- **Status:** PASS

### Scenario 7: Agent update via API
- **Description:** PUT /api/agents/:name updates an existing agent
- **Steps:**
  1. PUT /api/agents/test-agent with updated instructions
  2. GET /api/agents/test-agent to verify persistence
- **Expected:** Instructions updated to new value
- **Actual:** Instructions field returned "Updated instructions"
- **Status:** PASS

### Scenario 8: Agent delete via API
- **Description:** DELETE /api/agents/:name removes the agent
- **Steps:**
  1. DELETE /api/agents/test-agent
  2. GET /api/agents/test-agent
- **Expected:** DELETE returns 200, subsequent GET returns 404
- **Actual:** DELETE returned 200 with `{"deleted":"test-agent"}`, GET returned 404
- **Status:** PASS

### Scenario 9: Delete non-existent agent returns 404
- **Description:** DELETE /api/agents/:name for a non-existent agent should return 404
- **Steps:**
  1. DELETE /api/agents/nonexistent-agent
- **Expected:** 404 Not Found
- **Actual:** 404 returned
- **Status:** PASS

### Scenario 10: Agents page accessible via nav tab
- **Description:** The Agents page should be accessible via the "Agents" nav tab in the header
- **Steps:**
  1. Navigate to http://localhost:8080/agents
  2. Verify page loads with agent list
  3. Verify "Board" and "Agents" nav tabs present
- **Expected:** Agents page with list of agents, both nav tabs visible
- **Actual:** Agents page rendered with all 5 seed agents, both nav tabs present, "Agents" tab highlighted
- **Status:** PASS

### Scenario 11: Create agent via UI
- **Description:** Clicking "+ New Agent" should open a form to create an agent
- **Steps:**
  1. Click "+ New Agent" button
  2. Fill in Name, Instructions fields
  3. Click "Create"
  4. Verify agent appears in list
- **Expected:** New agent created and shown in the list
- **Actual:** Agent "ui-test-agent" created successfully, appeared in list with correct instructions and default tools
- **Status:** PASS

### Scenario 12: Edit agent via UI
- **Description:** Clicking "Edit" on an agent should open a pre-filled form
- **Steps:**
  1. Click "Edit" on ui-test-agent
  2. Verify form is pre-filled with current values
  3. Update instructions
  4. Click "Update"
  5. Verify changes reflected in list
- **Expected:** Instructions updated in the list
- **Actual:** Edit modal showed pre-filled values, updated instructions persisted and displayed correctly
- **Status:** PASS

### Scenario 13: Delete agent via UI
- **Description:** Clicking "Delete" on an agent should remove it
- **Steps:**
  1. Click "Delete" on ui-test-agent
  2. Verify agent no longer in list
- **Expected:** Agent removed from list (no confirmation dialog per developer note)
- **Actual:** Agent removed immediately, only 5 seed agents remain
- **Status:** PASS

### Scenario 14: Task detail does not show Workspace field
- **Description:** Task detail view should not display a "Workspace" field
- **Steps:**
  1. Navigate to Board view
  2. Click on a task
  3. Inspect Task Information section
- **Expected:** Fields shown: ID, Source, Session ID, Created, Updated (no Workspace)
- **Actual:** Fields shown: ID, Source, Session ID, Created, Updated. No Workspace field present.
- **Status:** PASS

### Scenario 15: Agent JSON has instructions, no specPath
- **Description:** GET /api/agents/:name should return instructions field, not specPath
- **Steps:**
  1. GET /api/agents/developer
  2. Check JSON keys
- **Expected:** Keys include "instructions", not "specPath"
- **Actual:** Keys: allowedTools, instructions, name, permissionMode. No specPath present.
- **Status:** PASS

### Scenario 16: Task JSON has no workspacePath
- **Description:** Task JSON should not contain workspacePath field
- **Steps:**
  1. POST /api/tasks to create a task
  2. Check JSON keys of created task
- **Expected:** No workspacePath key in task JSON
- **Actual:** Keys: agentChain, attachments, createdAt, currentAgent, description, id, sessionId, source, status, taskType, updatedAt. No workspacePath.
- **Status:** PASS

### Scenario 17: Build and tests pass
- **Description:** npm run build:all and npm run test should succeed
- **Steps:**
  1. Run npm run build:all
  2. Run npm run test
- **Expected:** Build compiles all modules, all tests pass
- **Actual:** Build succeeded (8 chorus-ui, 6 file-tools, 6 handoff-tool, 13 chorus modules). 27 unit tests passed, 19 integration tests passed.
- **Status:** PASS

### Scenario 18: Nav tab navigation works between Board and Agents
- **Description:** Clicking Board/Agents tabs navigates correctly
- **Steps:**
  1. From Agents page, click "Board"
  2. Verify Board view loads
  3. From Board, click "Agents"
  4. Verify Agents view loads
- **Expected:** Both views load correctly with appropriate content
- **Actual:** Board view showed kanban columns with tasks, Agents view showed agent list. Navigation between both worked correctly.
- **Status:** PASS

## Failures

No failures found.

## Test Code Quality Issues

### Issue 1: No unit tests for AgentConfig encoder/decoder
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** N/A (missing tests)
- **Problem:** There are no unit tests verifying AgentConfig encoding and decoding, including the backward-compatible decoder that was modified in this iteration. The decoder now has three distinct code paths (instructions field present, specPath field present, neither present) but none are tested at the unit level.
- **Suggestion:** Add unit tests for: (1) AgentConfig round-trip with instructions field, (2) AgentConfig decoding from old format with specPath field produces empty instructions, (3) AgentConfig decoding from JSON with neither instructions nor specPath fails.

### Issue 2: No unit test for the 409 conflict logic in requestCreateAgent
- **File:** `packages/chorus/src/Web/Api.gren`
- **Line:** 869-901
- **Problem:** The blocking fix (duplicate agent creation returning 409) has no automated test coverage. It was verified manually via API calls, but a regression could go undetected since the Gren integration test framework only tests Registry-level operations, not HTTP API behavior.
- **Suggestion:** Consider adding API-level integration tests (either Gren-based or script-based) that start the server and exercise HTTP endpoints. Alternatively, the conflict-check logic could be extracted into a testable function.

### Issue 3: Integration test count is hardcoded
- **File:** `packages/chorus/tests/integration/IntegrationRunner.gren`
- **Line:** 45
- **Problem:** The test runner hardcodes "Running 19 integration tests..." in the output string rather than dynamically counting from the tests array. If tests are added or removed, this string must be manually updated.
- **Suggestion:** Compute the count from `Array.length tests` and interpolate it into the output string, matching how the unit test runner already does this.

## Integration Tests Added

No integration tests were added. The changes in this iteration (409 conflict check, getAgent refactor, decoder strictness, sendBadRequest escaping) are all at the HTTP API layer or internal to modules that are not directly testable through the existing Gren integration test framework, which operates at the Registry/Queue level. The JSON-based integration test framework under `packages/tools/tests/integration/` is designed for file-tools and handoff-tool, not for Chorus API endpoints.

| Test Name | File | Validates |
|-----------|------|-----------|
| N/A | N/A | No applicable integration test infrastructure for these changes |

## Overall Assessment

**Decision:** PASS

All four fixes from the developer report have been verified:
1. **BLOCKING fix (409 Conflict on duplicate agent creation):** Working correctly. POST /api/agents with an existing name returns 409 with appropriate error message.
2. **Suggestion 1 (getAgent refactor):** Internal refactoring confirmed via code review. No behavioral change; all existing tests continue to pass.
3. **Suggestion 4 (Stricter decoder fallback):** Working correctly. JSON with specPath decodes to empty instructions. JSON with neither instructions nor specPath is rejected.
4. **Suggestion 5 (sendBadRequest JSON escaping):** Working correctly. Error responses use Encode.object for proper JSON construction.

Non-blocking observations:
- No unit tests exist for AgentConfig encoding/decoding (pre-existing gap, not introduced in this iteration)
- Delete agent in UI has no confirmation dialog (acknowledged as not addressed by developer)
- Integration test count string is hardcoded rather than dynamically computed (pre-existing)
