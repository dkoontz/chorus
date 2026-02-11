# QA Report

## Summary
All requirements for distinguishing internal vs external agents are correctly implemented. The `internal` boolean field is properly added to `AgentConfig`, the `_planner` agent is renamed to `task-validator` everywhere in code, the server rejects handoff to internal agents with HTTP 400, and the UI filters internal agents from both the agent dropdown and the Agents page. Build succeeds and all 46 tests (27 unit + 19 integration) pass.

## Test Scenarios

### Scenario 1: AgentConfig type has `internal` field
- **Description:** Verify the `internal` field exists on `AgentConfig` and is properly typed as `Bool`
- **Steps:**
  1. Read `packages/shared/Types.gren`
  2. Inspect the `AgentConfig` type alias
- **Expected:** `internal : Bool` field present in the type alias
- **Actual:** Field is present at line 260: `internal : Bool`
- **Status:** PASS

### Scenario 2: Encoder includes `internal` field
- **Description:** Verify `encodeAgentConfig` encodes the `internal` field as a JSON boolean
- **Steps:**
  1. Read `encodeAgentConfig` in `packages/shared/Types.gren`
  2. Verify `internal` is in the required fields
- **Expected:** `{ key = "internal", value = Encode.bool config.internal }` present
- **Actual:** Present at line 1073
- **Status:** PASS

### Scenario 3: Decoder requires `internal` field (no fallback)
- **Description:** Verify `agentConfigDecoder` requires the `internal` field and fails without it
- **Steps:**
  1. Read decoder in `packages/shared/Types.gren`
  2. POST to `/api/agents` without `internal` field
- **Expected:** Decoder uses `Decode.field "internal" Decode.bool` (required, no fallback); API rejects missing field
- **Actual:** Decoder at lines 1104-1108 uses `Decode.field "internal" Decode.bool` in an `andThen` chain. API returns 400: `"Invalid JSON body for agent config"` when `internal` is missing.
- **Status:** PASS

### Scenario 4: GET /api/agents returns all agents with `internal` field
- **Description:** Verify the API returns all 7 agents including internal ones, each with the `internal` field
- **Steps:**
  1. Start app on port 8079
  2. `curl http://localhost:8079/api/agents | jq '.data[] | {name, internal}'`
- **Expected:** 7 agents, `task-validator` with `internal: true`, all others `internal: false`
- **Actual:** All 7 agents returned: writer-workflow, fact-checker, editor, planner, writer, researcher (all `internal: false`), task-validator (`internal: true`)
- **Status:** PASS

### Scenario 5: `_planner` agent no longer exists
- **Description:** Verify the old `_planner` agent has been fully renamed
- **Steps:**
  1. `curl http://localhost:8079/api/agents/_planner`
- **Expected:** 404 Not Found
- **Actual:** `{"error":{"code":"NOT_FOUND","message":"Agent not found: _planner"}}`
- **Status:** PASS

### Scenario 6: `task-validator` seeded with `internal = True`
- **Description:** Verify the task-validator agent is marked internal in seed defaults
- **Steps:**
  1. Read `packages/chorus/src/Agent/Registry.gren` seed defaults
  2. Verify via API: `curl http://localhost:8079/api/agents/task-validator`
- **Expected:** `internal = True` in seed config and API response
- **Actual:** Seed config at line 157 has `internal = True`. API returns `"internal": true`
- **Status:** PASS

### Scenario 7: POST /api/tasks/:id/handoff rejects internal agents with HTTP 400
- **Description:** Verify the server-side guard prevents handoff to internal agents
- **Steps:**
  1. Create a task
  2. `curl -X POST /api/tasks/:id/handoff -d '{"agentName":"task-validator","prompt":"test"}'`
- **Expected:** HTTP 400 with error message about internal agent
- **Actual:** HTTP 400: `{"error":{"code":"BAD_REQUEST","message":"Cannot hand off to internal agent: task-validator"}}`
- **Status:** PASS

### Scenario 8: POST /api/tasks/:id/handoff accepts external agents
- **Description:** Verify handoff to external agents still works (non-regression)
- **Steps:**
  1. Create a task
  2. `curl -X POST /api/tasks/:id/handoff -d '{"agentName":"writer","prompt":"test prompt"}'`
- **Expected:** HTTP 200 with updated task
- **Actual:** HTTP 200, task updated with `currentAgent: "writer"` and handoff record
- **Status:** PASS

### Scenario 9: POST /api/tasks/:id/handoff rejects non-existent agents
- **Description:** Verify handoff to non-existent agents returns an appropriate error
- **Steps:**
  1. `curl -X POST /api/tasks/:id/handoff -d '{"agentName":"nonexistent-agent","prompt":"test"}'`
- **Expected:** HTTP 400 with agent not found error
- **Actual:** HTTP 400: `{"error":{"code":"BAD_REQUEST","message":"Agent registry error: Agent not found: nonexistent-agent"}}`
- **Status:** PASS

### Scenario 10: UI filters internal agents from task detail dropdown
- **Description:** Verify the agent selection dropdown in task detail only shows external agents
- **Steps:**
  1. Read `packages/chorus-ui/src/Main.gren` lines 1069-1081
- **Expected:** `Array.keepIf (\a -> not a.internal)` applied before passing agents to `TaskDetail.view`
- **Actual:** Lines 1069-1071 filter with `Array.keepIf (\a -> not a.internal)`, and only `.name` of filtered agents is passed to the view
- **Status:** PASS

### Scenario 11: UI filters internal agents from Agents management page
- **Description:** Verify the Agents page only shows external agents
- **Steps:**
  1. Read `packages/chorus-ui/src/Main.gren` line 1105
- **Expected:** `Array.keepIf (\a -> not a.internal)` applied before passing agents to `Agents.view`
- **Actual:** Line 1105: `agents = Array.keepIf (\a -> not a.internal) model.agents`
- **Status:** PASS

### Scenario 12: UI sets `internal = False` for user-created agents
- **Description:** Verify agents created through the UI form are always external
- **Steps:**
  1. Read `packages/chorus-ui/src/Main.gren` SaveAgent handler
- **Expected:** `internal = False` hardcoded in the AgentConfig construction
- **Actual:** Line 869: `internal = False`
- **Status:** PASS

### Scenario 13: `task-validator` system prompt updated
- **Description:** Verify the system prompt references "Task Validator" not "_planner"
- **Steps:**
  1. Read `taskValidatorInstructions` in `packages/chorus/src/Agent/Registry.gren`
- **Expected:** Title is "Task Validator", self-reference is `task-validator`, no `_planner` mentions
- **Actual:** Prompt title is "# Task Validator", guideline says `(not \`task-validator\`)` for `assignedAgent`, no `_planner` references
- **Status:** PASS

### Scenario 14: `dispatchPlanner` uses `task-validator`
- **Description:** Verify the planner dispatch function looks up the correct agent name
- **Steps:**
  1. Read `dispatchPlanner` in `packages/chorus/src/Main.gren`
- **Expected:** `AgentRegistry.getAgent agentReg "task-validator"` and error message references `task-validator`
- **Actual:** Line 1641: `AgentRegistry.getAgent agentReg "task-validator"`, line 1738: error `"task-validator agent not found"`
- **Status:** PASS

### Scenario 15: `planned` status string unchanged
- **Description:** Verify the task status value "planned" was NOT renamed (only the agent identity was renamed)
- **Steps:**
  1. Search for `"planned"` in `packages/shared/Types.gren`
- **Expected:** `"planned"` still used as the status type string for `ReadyToStart`
- **Actual:** Lines 645, 984, 1130, 1159 all use `"planned"` as the status string
- **Status:** PASS

### Scenario 16: Build succeeds
- **Description:** Verify `npm run build:all` completes successfully
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** All components compile without errors
- **Actual:** UI (9 modules), tools (4 targets), chorus (21 modules) all compiled successfully
- **Status:** PASS

### Scenario 17: All tests pass
- **Description:** Verify `npm run test` passes all tests
- **Steps:**
  1. Run `npm run test`
- **Expected:** All unit and integration tests pass
- **Actual:** 27 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

### Scenario 18: No `_planner` references in source code
- **Description:** Verify all code references to `_planner` have been renamed
- **Steps:**
  1. Search for `_planner` across the entire worktree
- **Expected:** No matches in `.gren` source files
- **Actual:** No matches in any `.gren` files. Remaining matches are only in documentation files (`docs/`, `tasks/`, `workspaces/reports/`) which describe the rename history.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No test code was added or modified for this feature. The existing test suite (27 unit + 19 integration) continues to pass and covers the type-level changes implicitly through compilation. The project's integration test framework (JSON-based tool tests and Gren-based registry tests) does not include HTTP API endpoint testing, so the server-side handoff guard cannot be covered by automated tests within the current test infrastructure. The UI filtering is also not amenable to automated testing without a browser testing framework.

## Integration Tests Added

No integration tests were added. The project's integration test infrastructure covers file-system-level registry operations and tool execution via JSON scenarios. The changes in this feature are at the HTTP API level (handoff guard) and UI level (agent filtering), neither of which has automated test infrastructure in the current project. All functional behavior was verified through manual API testing (curl) and source code review.

| Test Name | File | Validates |
| --------- | ---- | --------- |
| N/A | N/A | No applicable integration test framework for HTTP or UI tests |

## Overall Assessment

**Decision:** PASS

All 11 success criteria from the task specification are met:
1. `AgentConfig` type has `internal : Bool` -- verified
2. `encodeAgentConfig` encodes the `internal` field -- verified
3. `agentConfigDecoder` decodes the `internal` field (required, no fallback) -- verified
4. `_planner` agent renamed to `task-validator` everywhere in code -- verified
5. `task-validator` seeded with `internal = True`, others with `internal = False` -- verified
6. Agent dropdown in task detail only shows external agents -- verified (code review)
7. Agents page only shows external agents -- verified (code review)
8. `POST /api/tasks/:id/handoff` rejects internal agents with HTTP 400 -- verified (live test)
9. `npm run build:all` succeeds -- verified
10. `npm run test` passes -- verified (27 unit + 19 integration, 0 failures)
11. The `planned` status string is unchanged (only agent identity renamed) -- verified

Non-blocking observations:
- The project lacks HTTP API endpoint testing infrastructure. As more server-side guards are added, it would be beneficial to add an HTTP-level integration test framework.
- UI filtering was verified by code review only. A browser-based test framework would provide higher confidence for UI behavior.
