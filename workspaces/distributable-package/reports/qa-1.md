# QA Report

## Summary

All acceptance criteria pass. The `build:dist` script assembles a correct `dist/` directory, the app starts and stops cleanly from `dist/`, runtime data is created in `dist/data/`, source code tool path references are updated, and all 46 tests pass (27 unit, 19 integration). One minor non-blocking observation about `.claude/settings.json` permissions.

## Test Scenarios

### Scenario 1: build:dist creates correct dist/ layout
- **Description:** Run `npm run build:dist` and verify all expected files exist in `dist/`
- **Steps:**
  1. Run `npm run build:dist`
  2. List `dist/` contents recursively
- **Expected:** `dist/` contains `chorus` binary, `static/` with `index.html`, `styles.css`, `app.js`, and `tools/` with `file-tools`, `handoff-tool`, `task-tools`
- **Actual:** All expected files present. `dist/chorus` (60MB), `dist/static/{app.js, index.html, styles.css}`, `dist/tools/{file-tools, handoff-tool, task-tools}`
- **Status:** PASS

### Scenario 2: dist/tools/ contains all tool binaries via wildcard copy
- **Description:** Verify tool binaries are copied by wildcard, not hardcoded list
- **Steps:**
  1. Compare `packages/tools/build/` contents with `dist/tools/` contents
  2. Review `scripts/build-dist.sh` to confirm wildcard loop
- **Expected:** All 3 executables from `packages/tools/build/` appear in `dist/tools/` with matching sizes
- **Actual:** `file-tools` (60,076,848 bytes), `handoff-tool` (60,010,800 bytes), `task-tools` (60,010,800 bytes) -- all match source. Script uses `for bin in ... ; [ -f "$bin" ] && [ -x "$bin" ]` wildcard loop.
- **Status:** PASS

### Scenario 3: App starts from dist/ and is accessible
- **Description:** Run `npm run start` and verify the app starts on port 8080
- **Steps:**
  1. Run `npm run start`
  2. `curl http://localhost:8080/api/tasks`
  3. `curl http://localhost:8080/` for UI
- **Expected:** App starts, API returns task list, UI HTML is served
- **Actual:** Start script reported "App ready on http://localhost:8080". API returned `{"data":[],"meta":{...}}`. UI returned valid HTML with DOCTYPE.
- **Status:** PASS

### Scenario 4: App stops cleanly
- **Description:** Run `npm run stop` and verify the process terminates
- **Steps:**
  1. Run `npm run stop`
  2. Attempt to `curl` the API
- **Expected:** Process terminates, API is unreachable
- **Actual:** Stop script reported "Stopping app (PID ...)... App stopped." Curl returned exit code 7 (connection refused).
- **Status:** PASS

### Scenario 5: Runtime data is created in dist/data/
- **Description:** Verify data directories are created in `dist/data/`, not `$PROJECT_ROOT/data/`
- **Steps:**
  1. Start the app
  2. List `dist/data/` contents
  3. Check that `$PROJECT_ROOT/data/` does not exist
- **Expected:** `dist/data/` contains `registry/`, `workspaces/`, `uploads/`, `.pid`, and agent configs. No `$PROJECT_ROOT/data/` directory.
- **Actual:** `dist/data/` contained `.pid`, `agents/` (6 agent JSON files), `registry/registry.json`, `uploads/`, `workspaces/`. `$PROJECT_ROOT/data/` did not exist.
- **Status:** PASS

### Scenario 6: build:all produces a working dist
- **Description:** Run `npm run build:all` and verify it calls `build:dist`
- **Steps:**
  1. Run `npm run build:all`
  2. Verify `dist/` layout is correct
- **Expected:** `build:all` calls `build:dist` which calls `build:app` then assembles `dist/`
- **Actual:** Output showed `build:all` -> `build:dist` -> `build:app` chain. All modules compiled, dist assembled. All expected files present.
- **Status:** PASS

### Scenario 7: Rebuilding does not destroy dist/data/
- **Description:** Create test data in `dist/data/`, rebuild, verify data survives
- **Steps:**
  1. Start app so `dist/data/` is populated with real data
  2. Create additional test marker file in `dist/data/registry/test-file.txt`
  3. Run `npm run build:dist`
  4. Verify marker file and existing data still exist
- **Expected:** `dist/data/` contents survive the rebuild
- **Actual:** Marker file (`test-file.txt`) and all runtime data (`registry.json`, agent configs, etc.) survived the rebuild. `build-dist.sh` only removes `dist/chorus`, `dist/static`, `dist/tools`.
- **Status:** PASS

### Scenario 8: Clean script preserves dist/data/
- **Description:** Run `npm run clean` and verify dist/data/ survives while build artifacts are removed
- **Steps:**
  1. Run `npm run clean`
  2. List `dist/` contents
- **Expected:** `dist/chorus`, `dist/static/`, `dist/tools/` are removed. `dist/data/` survives.
- **Actual:** Only `dist/data/` remained in `dist/`. Contained `agents/`, `registry/`, `uploads/`, `workspaces/`.
- **Status:** PASS

### Scenario 9: Source code fileToolsPath updated
- **Description:** Verify `defaultConfig.fileToolsPath` is `"./tools/file-tools"`
- **Steps:**
  1. Read `packages/chorus/src/Main.gren` line 127
- **Expected:** `fileToolsPath = "./tools/file-tools"`
- **Actual:** `fileToolsPath = "./tools/file-tools"`
- **Status:** PASS

### Scenario 10: All allowedTools patterns reference tools/ prefix
- **Description:** Verify all `allowedTools` patterns in source code use `tools/` prefix
- **Steps:**
  1. Search `packages/chorus/src/` for `Bash(file-tools` and `Bash(handoff-tool` patterns
  2. Verify all code references (not comments) use `tools/` prefix
- **Expected:** All runtime patterns use `Bash(tools/file-tools *)` or `Bash(tools/handoff-tool *)`
- **Actual:** Registry.gren: 5 agent definitions all use `tools/` prefix. ClaudeCode.gren: both `buildCliArgs` and `buildShellCommand` default to `"Bash(tools/file-tools *)"`. Only remaining non-prefixed references are in code comments (documentation examples).
- **Status:** PASS

### Scenario 11: All tests pass
- **Description:** Run `npm run test` after all changes
- **Steps:**
  1. Run `npm run test`
- **Expected:** All unit and integration tests pass
- **Actual:** 27 unit tests passed, 19 integration tests passed. 0 failures.
- **Status:** PASS

### Scenario 12: build:copy-ui removed
- **Description:** Verify the `build:copy-ui` script has been removed from package.json
- **Steps:**
  1. Search package.json for `build:copy-ui`
- **Expected:** No `build:copy-ui` script in package.json
- **Actual:** Not found in package.json. UI files are now copied by `build-dist.sh` directly to `dist/static/`.
- **Status:** PASS

### Scenario 13: Full end-to-end from clean state
- **Description:** Clean, build, start, verify, stop -- complete workflow
- **Steps:**
  1. `npm run clean` (removes all build artifacts)
  2. `npm run build:dist` (full rebuild)
  3. `npm run start` (start app)
  4. `curl` API to verify
  5. `npm run stop` (stop app)
- **Expected:** Complete workflow succeeds
- **Actual:** All steps completed successfully. App started on first attempt, API responded, stop was clean.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

No test files were added or modified. The existing integration test framework (`packages/tools/tests/integration/*.json`) is designed for testing Gren-based CLI tools (file operations, handoff), not build/distribution scripts. The build and distribution behavior was verified through functional testing of the scripts and their outputs.

## Non-Blocking Observations

### Observation 1: Stale .claude/settings.json permission
- **File:** `.claude/settings.json`
- **Line:** 31
- **Problem:** Permission `Bash(npm run build:copy-ui)` still listed but the script no longer exists. Also missing `Bash(npm run build:dist)` permission.
- **Impact:** Non-functional -- only affects Claude Code agent permissions, not runtime behavior. `build:dist` is reachable through `build:all` which is already permitted.

### Observation 2: Code comments still reference non-prefixed tool names
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Lines:** 440-441, 456-457
- **Detail:** Documentation comments for `toolCliFlagFromAllowedTools` use `"Bash(file-tools *)"` as example input. This is intentional per the developer report -- these are documentation examples showing hypothetical input, not actual tool path references. No change needed.

## Integration Tests Added

| Test Name | File | Validates |
| --------- | ---- | --------- |
| (none) | - | Build/distribution changes are infrastructure, not tool behavior. The existing integration test framework targets Gren CLI tools, which is not applicable to shell scripts and npm script configuration. |

## Overall Assessment

**Decision:** PASS

All 10 acceptance criteria from the task specification are met:
1. `npm run build:dist` succeeds and creates correct `dist/` layout
2. `dist/tools/` uses wildcard copy for all tool binaries
3. `npm run start` runs chorus binary from `dist/`
4. `npm run stop` correctly stops the process
5. Runtime data is created in `dist/data/`, not `$PROJECT_ROOT/data/`
6. `npm run build:all` produces a working dist
7. `fileToolsPath` is `./tools/file-tools`
8. All `allowedTools` patterns use `tools/` prefix
9. All tests pass (27 unit + 19 integration)
10. Rebuilding preserves `dist/data/`
