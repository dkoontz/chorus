# QA Report

## Summary
All four review suggestions from iteration 1 have been correctly implemented. The build succeeds, all 87 tests pass (68 unit + 19 integration), and the application starts and serves requests. No regressions found.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Build all components to verify the changes compile
- **Steps:**
  1. Run `npm run build:all` in the worktree
- **Expected:** All three build phases (UI, tools, chorus) succeed
- **Actual:** UI compiled 13 modules, tools compiled 5 modules, chorus compiled 22 modules. Dist assembled.
- **Status:** PASS

### Scenario 2: All unit tests pass
- **Description:** Run unit test suite to verify no regressions
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** All 68 tests pass including the 10 ClaudeCode tests in the new module
- **Actual:** 68 passed, 0 failed
- **Status:** PASS

### Scenario 3: All integration tests pass
- **Description:** Run integration test suite
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** All 19 integration tests pass
- **Actual:** 19 passed, 0 failed
- **Status:** PASS

### Scenario 4: buildAgentSpawn helper correctly extracted (Suggestion 1)
- **Description:** Verify the shared helper function exists and both callers use it
- **Steps:**
  1. Read `packages/chorus/src/Main.gren` and locate `buildAgentSpawn` function at line 465
  2. Verify it takes `Model`, `TaskId`, `String`, `AgentConfig` and returns `{ executorState, spawnCmd }`
  3. Verify `GotHandoffRecorded` handler (line 852) destructures `buildAgentSpawn` result
  4. Verify `GotDeferredHandoffStarted` handler (line 925) destructures `buildAgentSpawn` result
  5. Verify the function has a doc comment explaining its purpose
- **Expected:** Single shared helper used by both handlers, no duplicated agent-spawning logic
- **Actual:** `buildAgentSpawn` is defined at lines 465-581 with a clear doc comment. Both `GotHandoffRecorded` (line 852) and `GotDeferredHandoffStarted` (line 925) call it via destructuring. The helper encapsulates provider resolution, shell command building, process spawning, and executor state construction. Each caller only contains its unique response-handling logic afterward.
- **Status:** PASS

### Scenario 5: Explicit ApiResult variant matching (Suggestion 2)
- **Description:** Verify the wildcard match in `GotDeferredHandoffStarted` is replaced with explicit variant matching
- **Steps:**
  1. Read the `GotDeferredHandoffStarted` handler at line 898
  2. Verify all three `ApiResult` variants are matched explicitly: `Api.ApiError`, `Api.DeferredHandoff`, `Api.ApiSuccess`
  3. Verify `DeferredHandoff` branch returns a 500 INTERNAL_ERROR since `requestStartHandoff` should never produce that variant
- **Expected:** No wildcard `_` match; all variants explicit
- **Actual:** Lines 901-942 match `Api.ApiError err` (sends error response), `Api.DeferredHandoff _` (sends 500 INTERNAL_ERROR with descriptive message), and `Api.ApiSuccess _` (proceeds with handoff). No wildcard present.
- **Status:** PASS

### Scenario 6: Timeout comment added (Suggestion 3)
- **Description:** Verify a comment explains the implicit timeout for deferred handoff responses
- **Steps:**
  1. Read the `Api.ApiSuccess` branch of `GotDeferredHandoffStarted` at lines 916-922
- **Expected:** Comment explaining the 600s ChildProcess timeout handles deferred response cleanup
- **Actual:** Lines 918-922 contain a multi-line comment: "Note: The deferred response is implicitly timed out by the ChildProcess runDuration of 600 seconds (10 minutes). If the agent process is killed by that timeout, GotAgentComplete fires with an error and resolves the pending response. No separate timeout mechanism is needed as long as the ChildProcess timeout remains in place."
- **Status:** PASS

### Scenario 7: Tests moved to ClaudeCodeTests module (Suggestion 4)
- **Description:** Verify provider-specific tests are in a dedicated module
- **Steps:**
  1. Read `packages/chorus/tests/unit/ClaudeCodeTests.gren`
  2. Verify it exposes `tests` array with 10 tests (4 `toolCliFlagFromAllowedTools` + 6 `chorusToolsToCliFlags`)
  3. Verify `RegistryTests.gren` no longer imports `Provider.ClaudeCode`
  4. Verify `TestRunner.gren` includes `ClaudeCodeTests.tests` in `allTests`
- **Expected:** Clean separation of test concerns; total test count unchanged at 68
- **Actual:** `ClaudeCodeTests.gren` contains 10 tests, has its own `expectEqual` helper, and imports only `Provider.ClaudeCode`. `RegistryTests.gren` has no `ClaudeCode` import and contains 28 registry-focused tests. `TestRunner.gren` includes `ClaudeCodeTests.tests` first in `allTests`. Total: 10 + 28 + 11 (Config) + 19 (Queue) = 68.
- **Status:** PASS

### Scenario 8: GotHandoffRecorded also uses explicit matching
- **Description:** Verify the existing `GotHandoffRecorded` handler also matches all ApiResult variants explicitly (consistency check)
- **Steps:**
  1. Read the `GotHandoffRecorded` handler starting at line 829
  2. Check for explicit `ApiError`, `DeferredHandoff`, and `ApiSuccess` branches
- **Expected:** All three variants matched explicitly
- **Actual:** Lines 835-864 match `Api.ApiError _` (sends error), `Api.DeferredHandoff _` (sends response -- marked as "should not happen"), and `Api.ApiSuccess _` (spawns agent). Both handlers follow the same pattern.
- **Status:** PASS

### Scenario 9: App starts and serves requests
- **Description:** Start the app and verify basic API functionality end-to-end
- **Steps:**
  1. Run `npm run start`
  2. Create config via `POST /api/config/create`
  3. Create task via `POST /api/tasks`
  4. Test chorus-tools binary with the created task ID
- **Expected:** App starts, accepts API requests, chorus-tools binary forwards to server
- **Actual:** App started on port 8080. Config creation returned valid config data. Task creation returned a valid task ID. Running `chorus-tools '{"tool":"help"}'` with the task ID correctly forwarded to the server and returned "No agent currently active on this task" error (expected, since no agent was spawned).
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

### Issue 1: Duplicated expectEqual helper
- **File:** `packages/chorus/tests/unit/ClaudeCodeTests.gren` (line 28) and `packages/chorus/tests/unit/RegistryTests.gren` (line 74)
- **Problem:** Both test modules define their own `expectEqual` helper with essentially the same implementation. The only difference is the error message format: ClaudeCodeTests uses `"Expected: " ++ ... ++ " but got: " ++ ...` while RegistryTests uses `"Expected: " ++ ... ++ "\nActual: " ++ ...`. This duplication is a minor maintainability concern.
- **Suggestion:** Consider extracting a shared `TestHelpers.gren` module that both test files can import. This is not blocking.

## Integration Tests Added

No new integration tests were added in this iteration. The four changes (helper extraction, explicit matching, timeout comment, test reorganization) are structural refactors that do not change observable behavior. They are adequately covered by the existing 68 unit tests and 19 integration tests, which all continue to pass.

## Overall Assessment

**Decision:** PASS

All four review suggestions have been implemented correctly:

1. **buildAgentSpawn helper**: Well-structured extraction with a clear doc comment. Both `GotHandoffRecorded` and `GotDeferredHandoffStarted` use it via destructuring, eliminating duplicated provider resolution and process spawning logic.

2. **Explicit ApiResult matching**: The `GotDeferredHandoffStarted` handler now matches all three variants (`ApiError`, `DeferredHandoff`, `ApiSuccess`) explicitly. The `DeferredHandoff` branch returns an appropriate 500 error since that variant should never occur from `requestStartHandoff`.

3. **Timeout comment**: A clear, multi-line comment at lines 918-922 explains that the ChildProcess `runDuration` of 600 seconds implicitly handles timeout for deferred responses, making the design decision discoverable for future maintainers.

4. **Test reorganization**: The 10 provider-specific tests are cleanly separated into `ClaudeCodeTests.gren`. The `RegistryTests.gren` module no longer imports `Provider.ClaudeCode`. The test runner correctly includes the new module. Total test count remains 68.

No regressions were found. The build compiles cleanly, all tests pass, and the application starts and serves requests correctly.
