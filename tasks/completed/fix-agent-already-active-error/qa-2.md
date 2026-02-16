# QA Report

## Summary

All changes from iteration 2 verified successfully. The `statusDecoder` fallback, inline status string cleanup, hardcoded "planning" comments, and new round-trip tests all work as intended. Build passes, 87 tests pass, and the core bug fix (agent identity dropped on transition to ReadyToStart) is confirmed through API-level testing.

## Test Scenarios

### Scenario 1: Planning -> ReadyToStart drops agent identity (core bug fix)
- **Description:** Verify that transitioning from Planning (with agent) to ReadyToStart removes the agent, making "Start Task" possible without the "Agent already active" error.
- **Steps:**
  1. Create a task (Pending status)
  2. Transition to Planning with `agent: "task-validator"`
  3. Transition to ReadyToStart (`planned`)
  4. Verify status response has no `agent` field
- **Expected:** ReadyToStart status contains no agent info
- **Actual:** Status response is `{"type": "planned"}` with no agent field
- **Status:** PASS

### Scenario 2: Planning -> AwaitingInput drops agent identity
- **Description:** Verify that transitioning from Planning to AwaitingInput also drops the agent.
- **Steps:**
  1. Create a task, transition to Planning with agent
  2. Transition to AwaitingInput
  3. Verify status has no agent field
- **Expected:** AwaitingInput status carries no agent
- **Actual:** Status is `{"type": "awaiting_input"}` with no agent
- **Status:** PASS

### Scenario 3: Active and Waiting statuses carry agent info
- **Description:** Verify that Active and Waiting statuses correctly embed the agent name.
- **Steps:**
  1. Transition task through Planning -> ReadyToStart -> Active (with developer)
  2. Transition to Waiting
  3. Verify both carry agent info
- **Expected:** `Active` and `Waiting` encode `agent` field with correct agent name
- **Actual:** Active shows `{"type": "active", "agent": "developer"}`, Waiting shows `{"type": "waiting", "agent": "developer"}`
- **Status:** PASS

### Scenario 4: Flat string backward compatibility with agent inheritance
- **Description:** Verify that the flat string status format (`{"status": "waiting"}`) correctly inherits agent info from the current status.
- **Steps:**
  1. Set task to Active with `agent: "developer"` (via object format)
  2. Transition to Waiting using flat string `{"status": "waiting"}`
  3. Transition back to Active using flat string `{"status": "active"}`
- **Expected:** Agent name "developer" inherited from current status in both transitions
- **Actual:** Waiting shows `agent: "developer"`, Active shows `agent: "developer"` -- inheritance works correctly
- **Status:** PASS

### Scenario 5: Invalid transitions are still rejected
- **Description:** Verify the transition guard (`isValidTransition`) still works with the new type structure.
- **Steps:**
  1. From Active, attempt transition to Planning (invalid)
  2. From Active, attempt transition to Pending (invalid)
  3. From Completed, attempt transition to Active (invalid)
- **Expected:** All return 409 INVALID_TRANSITION
- **Actual:** All return 409 with appropriate error messages
- **Status:** PASS

### Scenario 6: Planning -> Failed drops agent identity
- **Description:** Verify that failing from Planning status drops the agent and carries only the error message.
- **Steps:**
  1. Create task, transition to Planning with agent
  2. Transition to Failed with error message
- **Expected:** Failed status carries error message, no agent
- **Actual:** Status is `{"type": "failed", "message": "Planning failed due to timeout"}`
- **Status:** PASS

### Scenario 7: Status filtering works with new type structure
- **Description:** Verify that listing tasks by status filter still works, since `statusEquals` ignores agent data.
- **Steps:**
  1. Create multiple tasks in various statuses
  2. Filter by `?status=planning`, `?status=planned`, `?status=completed`
- **Expected:** Correct tasks returned for each filter
- **Actual:** Filters return the correct subset of tasks
- **Status:** PASS

### Scenario 8: Backward compatibility with old task data format
- **Description:** Verify that pre-existing task data (old format with `currentAgent` field and status without `agent` field) can still be decoded.
- **Steps:**
  1. Create a task file in old format: status `{"type": "planning"}` (no agent field) + top-level `currentAgent: "task-validator"`
  2. Read the task via API
- **Expected:** Task decodes successfully, status gets empty agent placeholder
- **Actual:** Task returned with `{"type": "planning", "agent": ""}` -- decoded via `Decode.oneOf` fallback. The old `currentAgent` field is ignored.
- **Status:** PASS

### Scenario 9: Persisted data no longer contains currentAgent field
- **Description:** Verify that newly created/updated tasks do not include `currentAgent` in their persisted JSON.
- **Steps:**
  1. Check registry.json (index) for presence of `currentAgent`
  2. Check individual task.json files for presence of `currentAgent`
- **Expected:** No `currentAgent` field in any new data
- **Actual:** Registry index entries and task files have no `currentAgent` field
- **Status:** PASS

### Scenario 10: Build and unit tests pass
- **Description:** Verify all three components build and tests pass.
- **Steps:**
  1. Run `npm run build:dist`
  2. Run `npm run test`
- **Expected:** Build succeeds, all tests pass
- **Actual:** Build succeeds (chorus-ui, tools, chorus all compiled). 87 tests passed, 0 failed.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

### Issue 1: testTaskCurrentAgentDerivedFromStatus tests multiple assertions per test
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 789-850
- **Problem:** The test chains four assertions (Pending, ReadyToStart, Planning, Waiting) into a single test. If the first assertion fails, the remaining three are not tested. Per the QA standards, each test should verify one thing.
- **Suggestion:** This is a minor concern. In Gren's test runner, chaining assertions is the idiomatic pattern due to the Task-based model. The test name accurately describes the composite check ("returns Nothing for at-rest statuses"), and failure messages would identify which specific assertion failed. No change needed.

### Issue 2: testTaskCurrentAgentAccessor also chains multiple assertions
- **File:** `packages/chorus/tests/unit/RegistryTests.gren`
- **Line:** 745-786
- **Problem:** Tests two task types (DescriptionOnly and Planned) in a single test.
- **Suggestion:** Same as above -- acceptable given Gren's idioms. The test name explicitly says "both task types."

## Integration Tests Added

No integration tests were added. The QA_STANDARDS.md integration test framework is designed for tool-level tests (`packages/tools/tests/integration/`), testing the `chorus-tools` CLI proxy behavior. This feature modifies internal type definitions and status transitions in the Chorus server -- there are no tool behavior changes to test via integration tests. The existing unit tests (87 passing, including 2 new round-trip tests for Planning and Waiting statuses) and the API-level scenarios documented above provide adequate coverage.

## Overall Assessment

**Decision:** PASS

The iteration 2 changes correctly address all review feedback:

1. **statusDecoder fallback** (blocking issue): The `Decode.oneOf` pattern works correctly for both new data (with agent field) and old data (without agent field). Pre-existing persisted tasks decode successfully with an empty agent name placeholder.

2. **Inline status string in ToolExecution.gren**: The `newStatus` computation is now properly scoped and uses `Types.statusToString` instead of duplicated inline mapping.

3. **Hardcoded "planning" comments in Api.gren**: Clear comments explain why the literal string is used instead of computing from the task's previous status.

4. **Round-trip tests**: `testStatusPlanning` and `testStatusWaiting` verify that `Planning { agentName = "task-validator" }` and `Waiting { agentName = "developer-agent" }` survive full task encode/decode cycles.

The core bug fix (agent identity embedded in TaskStatus making stale agents structurally impossible) is confirmed working through comprehensive API testing.
