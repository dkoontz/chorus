# QA Report

## Summary
All acceptance criteria pass. The iteration 2 changes (renaming `wsRoot` to `configRoot`, extracting `parentDirectory` helper, and making fallback values consistent with `Debug.todo`) are correctly implemented. The build succeeds, all 65 tests pass, and the running application produces the expected flat workspace directory structure with no `dataDirectory` field in the config.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify the application compiles without errors after all changes
- **Steps:**
  1. Run `npm run build:all`
- **Expected:** All three packages (chorus-ui, tools, chorus) compile successfully
- **Actual:** Build completed successfully with no errors
- **Status:** PASS

### Scenario 2: All tests pass
- **Description:** Verify unit and integration tests pass
- **Steps:**
  1. Run `npm run test`
- **Expected:** All unit and integration tests pass
- **Actual:** 46 unit tests passed, 19 integration tests passed, 0 failures
- **Status:** PASS

### Scenario 3: New workspace has flat directory structure
- **Description:** Creating a new workspace should produce directories at the workspace root with no `data/` or `agent_workspace` subdirectories
- **Steps:**
  1. Start the application with `npm run start`
  2. POST to `/api/config/create` with `{"path": "/tmp/qa-test-workspace"}`
  3. List directory contents of `/tmp/qa-test-workspace/`
- **Expected:** Directory contains `chorus.json`, `agents/`, `providers/`, `registry/`, `uploads/` at root level; no `data/` or `agent_workspace/` directories
- **Actual:** Directory contained exactly `chorus.json`, `agents/`, `providers/`, `registry/`, `uploads/` at root level. No `data/` or `agent_workspace/` directories present.
- **Status:** PASS

### Scenario 4: Config response has no dataDirectory field
- **Description:** The API should return workspace config without a `dataDirectory` field
- **Steps:**
  1. POST to `/api/config/create` with `{"path": "/tmp/qa-test-workspace"}`
  2. GET `/api/config`
- **Expected:** Response contains `agentsDirectory`, `allowedAgentDirectories`, `initialAgentDirectory`, `systemAgentProvider` but not `dataDirectory`
- **Actual:** Response was `{"data":{"agentsDirectory":"/tmp/qa-test-workspace/agents","allowedAgentDirectories":[],"initialAgentDirectory":"","systemAgentProvider":"not-configured"},"configPath":"/tmp/qa-test-workspace/chorus.json"}` with no `dataDirectory` field
- **Status:** PASS

### Scenario 5: createWorkspaceConfig defaults are correct
- **Description:** New workspace config should have empty allowed directories and empty initial agent directory
- **Steps:**
  1. POST to `/api/config/create` with `{"path": "/tmp/qa-test-workspace"}`
  2. Inspect response fields
- **Expected:** `allowedAgentDirectories` is `[]` and `initialAgentDirectory` is `""`
- **Actual:** `allowedAgentDirectories` was `[]` and `initialAgentDirectory` was `""`
- **Status:** PASS

### Scenario 6: chorus.json file has no dataDirectory
- **Description:** The serialized config file should not contain a dataDirectory key
- **Steps:**
  1. POST to `/api/config/create` with `{"path": "/tmp/qa-test-workspace"}`
  2. Read `/tmp/qa-test-workspace/chorus.json`
- **Expected:** JSON file contains `agentsDirectory`, `allowedAgentDirectories`, `initialAgentDirectory`, `systemAgentProvider` but not `dataDirectory`
- **Actual:** File contained exactly `{"agentsDirectory":"/tmp/qa-test-workspace/agents","allowedAgentDirectories":[],"initialAgentDirectory":"","systemAgentProvider":"not-configured"}`
- **Status:** PASS

### Scenario 7: Empty initialAgentDirectory passes validation
- **Description:** Config update should allow an empty `initialAgentDirectory` even if it is not in the allowed directories list
- **Steps:**
  1. PUT to `/api/config` with `{"agentsDirectory":"...","allowedAgentDirectories":["/tmp/test-dir"],"initialAgentDirectory":"","systemAgentProvider":"not-configured"}`
- **Expected:** Config update succeeds (200 OK)
- **Actual:** Config update succeeded, returned updated config
- **Status:** PASS

### Scenario 8: Non-empty initialAgentDirectory not in allowed list is rejected
- **Description:** Config update should reject a non-empty `initialAgentDirectory` that is not in the allowed directories list
- **Steps:**
  1. PUT to `/api/config` with `initialAgentDirectory` set to `/tmp/not-in-allowed` while `allowedAgentDirectories` is `["/tmp/test-dir"]`
- **Expected:** 400 Bad Request with validation error message
- **Actual:** Returned `{"error":{"code":"BAD_REQUEST","message":"initialAgentDirectory must be one of the allowedAgentDirectories"}}`
- **Status:** PASS

### Scenario 9: wsRoot variable name is eliminated
- **Description:** The blocking issue from review 1 (abbreviated variable name `wsRoot`) should no longer exist in the codebase
- **Steps:**
  1. Search for `wsRoot` in `packages/chorus/src/Main.gren`
- **Expected:** No matches found
- **Actual:** No matches found. The variable was renamed to `configRoot`.
- **Status:** PASS

### Scenario 10: parentDirectory helper replaces all duplicated path-stripping
- **Description:** The duplicated `String.split "/" |> Array.dropLast 1 |> String.join "/"` pattern should only exist in the `parentDirectory` function
- **Steps:**
  1. Search for `dropLast` in `packages/chorus/src/Main.gren`
- **Expected:** Only one occurrence, inside the `parentDirectory` function definition
- **Actual:** One occurrence at line 2207, inside the `parentDirectory` function
- **Status:** PASS

### Scenario 11: Fallback values are consistent with Debug.todo
- **Description:** All `Nothing` branches for workspace path derivation should use `Debug.todo`
- **Steps:**
  1. Search for `Debug.todo` in `packages/chorus/src/Main.gren`
  2. Verify `conversationsDir` and `registryRoot` in makeProvider and tool handler use `Debug.todo`
- **Expected:** `conversationsDir` (line ~281), `registryRoot` (line ~492), `workspaceRoot` (line ~2224), and `initialAgentDir` (line ~2259) all use `Debug.todo`
- **Actual:** All four locations use `Debug.todo` with descriptive error messages
- **Status:** PASS

### Scenario 12: No remaining dataDirectory references in source code
- **Description:** No source files should reference `dataDirectory`
- **Steps:**
  1. Search for `dataDirectory` across all source files in the worktree
- **Expected:** No matches in `.gren` source files (only in task documentation and old reports)
- **Actual:** No matches in any source files. Only references found were in task documentation and historical reports.
- **Status:** PASS

### Scenario 13: UI placeholder text updated
- **Description:** The initial agent directory input placeholder should no longer reference `agent_workspace`
- **Steps:**
  1. Read `packages/chorus-ui/src/View/SystemSettings.gren` and check the placeholder text
- **Expected:** Placeholder is `/path/to/working/directory` (not `/path/to/agent_workspace`)
- **Actual:** Placeholder is `/path/to/working/directory` at line 110
- **Status:** PASS

### Scenario 14: Data Directory form field removed from System Settings
- **Description:** The System Settings form should not contain a Data Directory field
- **Steps:**
  1. Review `packages/chorus-ui/src/View/SystemSettings.gren` for any "Data Directory" label or `settings-data-dir` ID
- **Expected:** No Data Directory form group present
- **Actual:** The form group with label "Data Directory" and ID `settings-data-dir` was removed. The first form field is now "Agents Directory".
- **Status:** PASS

### Scenario 15: Data Directory info row removed from Workspaces view
- **Description:** The active workspace info display should not show a Data Directory row
- **Steps:**
  1. Review `packages/chorus-ui/src/View/Workspaces.gren` for "Data Directory" label
- **Expected:** No Data Directory info row present
- **Actual:** The info row with label "Data Directory:" was removed. The workspace info shows Config Path and Agents Directory only.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No test files were added or modified in this feature. The existing integration test framework (`packages/tools/tests/integration/`) is designed for tool-level testing (file operations, task operations, handoff) and does not cover workspace configuration API operations. No integration tests could be added because the workspace config endpoints are application-level HTTP API routes, not tool invocations that the integration test runner supports.

## Integration Tests Added

No integration tests were added. The integration test framework is scoped to the tools package (`packages/tools/tests/integration/{tool-name}.json`) and does not support testing workspace config HTTP API endpoints. The workspace creation, config loading, and config update operations were verified through manual API testing against the running application.

## Overall Assessment

**Decision:** PASS

All 11 acceptance criteria from the task specification are met. The iteration 2 changes correctly address all three items from the code review: the blocking `wsRoot` rename (to `configRoot`, justified by Gren's no-shadowing constraint), the `parentDirectory` helper extraction eliminating all duplicated path-stripping logic, and the fallback consistency change to `Debug.todo`. The validation logic was also correctly updated to allow empty `initialAgentDirectory`. Build succeeds and all 65 tests (46 unit, 19 integration) pass.
