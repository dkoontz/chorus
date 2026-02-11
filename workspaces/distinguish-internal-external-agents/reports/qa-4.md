# QA Report

## Summary
All changes from iteration 4 (revert naming regressions and fix doc comment inaccuracies) are correctly implemented. The `filesystemPermission` naming is restored throughout Registry.gren, `taskId` is restored in the test helper, doc comments are accurate, and the `validateExistingFiles` error handling is improved. Build succeeds (9 UI + 21 chorus modules), all 54 tests pass (35 unit + 19 integration), and the running application behaves correctly via API testing.

## Test Scenarios

### Scenario 1: `fsPermission` reverted to `filesystemPermission`
- **Description:** Verify the shortened `fsPermission` name was reverted back to the full `filesystemPermission` throughout Registry.gren
- **Steps:**
  1. Search for `fsPermission` in `packages/chorus/src/Agent/Registry.gren`
  2. Count occurrences of `filesystemPermission` in the same file
- **Expected:** Zero occurrences of `fsPermission`, multiple of `filesystemPermission`
- **Actual:** Zero occurrences of `fsPermission`, 28 occurrences of `filesystemPermission` (record fields, function parameters, and usage sites)
- **Status:** PASS

### Scenario 2: `tid` reverted to `taskId` in test helper
- **Description:** Verify the shortened `tid` variable was reverted back to `taskId` in the `testTaskId` helper function in RegistryTests.gren
- **Steps:**
  1. Search for `\btid\b` in `packages/chorus/tests/unit/RegistryTests.gren`
  2. Read the `testTaskId` helper function
- **Expected:** No occurrences of `tid`; the helper uses `taskId` as the local variable
- **Actual:** Zero occurrences of `tid`. The helper function at lines 57-64 uses `taskId` as the local variable name in the `when` expression
- **Status:** PASS

### Scenario 3: Module doc comment accuracy
- **Description:** Verify the module doc comment says "all known agents" (not a specific count) and includes `task-validator` in the list
- **Steps:**
  1. Read the module doc comment at the top of `packages/chorus/src/Agent/Registry.gren`
- **Expected:** "all known agents" (not "six known agents"), and the list includes `task-validator`
- **Actual:** Lines 15-16: "default configs are seeded for all known agents: researcher, planner, writer-workflow, writer, editor, fact-checker, task-validator."
- **Status:** PASS

### Scenario 4: `seedDefaults` doc comment accuracy
- **Description:** Verify the `seedDefaults` doc comment says "all known agents" instead of a specific number
- **Steps:**
  1. Read the doc comment for `seedDefaults` in `packages/chorus/src/Agent/Registry.gren`
- **Expected:** "Write default configs for all known agents."
- **Actual:** Line 159: "Write default configs for all known agents."
- **Status:** PASS

### Scenario 5: `validateExistingFiles` error handling
- **Description:** Verify that only `JsonDecodeError` is treated as invalid format (returning `False` for re-seeding), while `FileSystemError` and `AgentNotFound` are propagated as real failures
- **Steps:**
  1. Read the `validateExistingFiles` function in `packages/chorus/src/Agent/Registry.gren`
  2. Verify the error pattern matching in the `onError` handler
- **Expected:** `JsonDecodeError _` -> `GrenTask.succeed False`; `_ ->` -> `GrenTask.fail err`
- **Actual:** Lines 120-127: `when err is` matches `JsonDecodeError _ -> GrenTask.succeed False` and `_ -> GrenTask.fail err`. This correctly prevents filesystem errors (e.g., permission denied) from triggering a delete-and-re-seed cycle.
- **Status:** PASS

### Scenario 6: Build succeeds
- **Description:** Verify `npm run build:dist` completes without errors
- **Steps:**
  1. Run `npm run build:dist` in the worktree
- **Expected:** All components compile successfully
- **Actual:** UI (9 modules), tools (4 targets), chorus (21 modules) all compiled successfully. dist/ assembled.
- **Status:** PASS

### Scenario 7: All tests pass
- **Description:** Verify `npm run test` passes all tests
- **Steps:**
  1. Run `npm run test` in the worktree
- **Expected:** All unit and integration tests pass
- **Actual:** 35 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

### Scenario 8: API returns correct type discriminator for all agents
- **Description:** Verify the GET /api/agents endpoint returns all 7 agents with correct `type` discriminator values
- **Steps:**
  1. Start the app
  2. `curl http://localhost:8080/api/agents | jq '.data[] | {name, type}'`
- **Expected:** 6 agents with `type: "user_defined"`, 1 agent (`task-validator`) with `type: "internal"`
- **Actual:** All 7 agents returned with correct type values: writer-workflow, fact-checker, editor, planner, writer, researcher (all `user_defined`), task-validator (`internal`)
- **Status:** PASS

### Scenario 9: Internal agent has minimal fields in API response
- **Description:** Verify the `task-validator` InternalAgent only has `type`, `name`, and `instructions` fields (no `provider`, `model`, or `allowedTools`)
- **Steps:**
  1. `curl http://localhost:8080/api/agents/task-validator | jq '.data'`
- **Expected:** Only `type`, `name`, and `instructions` fields present
- **Actual:** Response contains exactly `{ "type": "internal", "name": "task-validator", "instructions": "..." }` -- no extraneous fields
- **Status:** PASS

### Scenario 10: Handoff to internal agent rejected
- **Description:** Verify POST /api/tasks/:id/handoff rejects handoff to internal agents with HTTP 400
- **Steps:**
  1. POST to `/api/tasks/:id/handoff` with `agentName: "task-validator"`
- **Expected:** HTTP 400 with descriptive error message
- **Actual:** HTTP 400: `{"error":{"code":"BAD_REQUEST","message":"Cannot hand off to internal agent: task-validator"}}`
- **Status:** PASS

### Scenario 11: Handoff to external agent succeeds
- **Description:** Verify POST /api/tasks/:id/handoff still works for external agents (non-regression)
- **Steps:**
  1. POST to `/api/tasks/:id/handoff` with `agentName: "researcher"`
- **Expected:** HTTP 200
- **Actual:** HTTP 200
- **Status:** PASS

### Scenario 12: No `_planner` references remain in source code
- **Description:** Verify all `.gren` source files are free of `_planner` references
- **Steps:**
  1. Search for `_planner` across all `.gren` files in the worktree
- **Expected:** No matches
- **Actual:** No matches in any `.gren` files
- **Status:** PASS

### Scenario 13: UI filters internal agents from task detail dropdown
- **Description:** Verify the task detail page filters internal agents before passing to the dropdown
- **Steps:**
  1. Read `viewMain` function in `packages/chorus-ui/src/Main.gren` (lines 1084-1097)
- **Expected:** `Array.keepIf (\a -> not (Types.isInternalAgent a))` applied, then `Array.map Types.agentConfigName` for names
- **Actual:** Lines 1085-1087: `externalAgents = model.agents |> Array.keepIf (\a -> not (Types.isInternalAgent a))`, line 1097: `agents = Array.map Types.agentConfigName externalAgents`
- **Status:** PASS

### Scenario 14: UI filters internal agents from Agents management page
- **Description:** Verify the Agents page filters internal agents
- **Steps:**
  1. Read `viewMain` function in `packages/chorus-ui/src/Main.gren` (line 1121)
- **Expected:** `Array.keepIf (\a -> not (Types.isInternalAgent a))` applied
- **Actual:** Line 1121: `agents = Array.keepIf (\a -> not (Types.isInternalAgent a)) model.agents`
- **Status:** PASS

### Scenario 15: UI creates agents as UserDefinedAgent
- **Description:** Verify user-created agents use the `UserDefinedAgent` constructor
- **Steps:**
  1. Read `SaveAgent` handler in `packages/chorus-ui/src/Main.gren` (lines 862-895)
- **Expected:** `UserDefinedAgent { ... }` constructor used
- **Actual:** Line 872: `UserDefinedAgent { name = form.name, instructions = form.instructions, allowedTools = ..., provider = form.provider, model = ... }`
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No new test quality issues. The iteration 4 changes to `RegistryTests.gren` were limited to reverting the `tid` variable name back to `taskId` in the `testTaskId` helper (line 58). The existing AgentConfig tests (8 tests covering encode/decode for both variants, unknown type rejection, and helper function behavior) are well-structured with single assertions per test, meaningful names, exact equality checks, and proper failure case coverage.

## Integration Tests Added

No integration tests were added in this iteration. The changes were limited to naming reversions and doc comment fixes in `Registry.gren` and `RegistryTests.gren`. These are code quality corrections that do not introduce new behavior requiring automated testing. The existing 35 unit tests and 19 integration tests continue to cover all functional behavior.

| Test Name | File | Validates |
| --------- | ---- | --------- |
| N/A | N/A | No new behavior introduced; changes are naming reversions and doc comment fixes |

## Overall Assessment

**Decision:** PASS

All five issues from the iteration 3 review have been correctly addressed:

1. **BLOCKING - `fsPermission` reverted to `filesystemPermission`**: Confirmed zero occurrences of `fsPermission`, 28 occurrences of `filesystemPermission` throughout Registry.gren.
2. **BLOCKING - `tid` reverted to `taskId`**: Confirmed the `testTaskId` helper uses `taskId` as the local variable name.
3. **Suggestion - Module doc comment**: Updated to "all known agents" with `task-validator` included in the list.
4. **Suggestion - `seedDefaults` doc comment**: Updated to "all known agents".
5. **Suggestion - `validateExistingFiles` error handling**: Now properly distinguishes `JsonDecodeError` (treated as invalid format for re-seeding) from `FileSystemError`/`AgentNotFound` (propagated as real failures).

The overall feature (distinguishing internal vs external agents) remains fully functional. Build compiles 9 UI modules and 21 chorus modules without errors. All 54 tests (35 unit + 19 integration) pass. The running application correctly serves agents with the `type` discriminator, rejects handoff to internal agents, and the UI code properly filters internal agents from user-facing views.
