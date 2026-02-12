# QA Report

## Summary
The Docker removal and direct execution conversion is partially complete. All Docker files and references have been removed, agent scripts are correctly rewritten, documentation is updated, PID management is consistent, and the build/test suites pass. However, the app cannot be started with `npm run start` because the `gren make` output (`build/chorus.js`) does not auto-initialize the Gren program. The `gren run Main` command produces a different output that includes the required initialization call, but the npm scripts and agent scripts use `node build/chorus.js` which silently exits.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Run `npm run build:app` and verify all modules compile
- **Steps:**
  1. Run `scripts/agent/build.sh`
- **Expected:** All components build without errors
- **Actual:** UI (7 modules), tools (4 modules), chorus (9 modules) all compiled. Static assets copied.
- **Status:** PASS

### Scenario 2: Tests pass
- **Description:** Run full test suite
- **Steps:**
  1. Run `scripts/agent/test.sh`
- **Expected:** All unit and integration tests pass
- **Actual:** 23 unit tests passed, 18 integration tests passed, 0 failures.
- **Status:** PASS

### Scenario 3: Docker files removed
- **Description:** Verify Dockerfile, docker-compose.yml, and .dockerignore are deleted
- **Steps:**
  1. Search for Dockerfile, docker-compose.yml, .dockerignore in project root
- **Expected:** Files do not exist
- **Actual:** All three files are absent from the filesystem.
- **Status:** PASS

### Scenario 4: Old Docker agent scripts removed
- **Description:** Verify build-docker.sh, start-docker.sh, stop-docker.sh, restart-docker.sh, docker-status.sh, docker-logs.sh are deleted
- **Steps:**
  1. Search for each file in `scripts/agent/`
- **Expected:** None of the old Docker scripts exist
- **Actual:** None found. Only the expected scripts remain: build.sh, start.sh, stop.sh, restart.sh, status.sh, logs.sh, test.sh, curl-api.sh.
- **Status:** PASS

### Scenario 5: New agent scripts exist
- **Description:** Verify start.sh, stop.sh, restart.sh, status.sh, logs.sh exist
- **Steps:**
  1. List files in `scripts/agent/`
- **Expected:** All five new scripts present
- **Actual:** All present.
- **Status:** PASS

### Scenario 6: npm run start launches app
- **Description:** Verify `npm run start` launches the app in the background and creates log file
- **Steps:**
  1. Run `npm run start`
  2. Wait 5 seconds
  3. Check if PID file exists at `data/.pid`
  4. Check if process is running
  5. Check if log file exists at `/tmp/-Users-david-dev-chorus.log`
  6. Attempt `curl http://localhost:8080/api/tasks`
- **Expected:** App starts, PID file written, log file created, API responds
- **Actual:** PID file is written correctly to `data/.pid`. Log file is created and truncated. However, the node process exits immediately with code 0 and produces no log output. The API does not respond. The compiled `build/chorus.js` (produced by `gren make Main --output=build/chorus.js`) does not call `Gren.Main.init({})`, so the Gren program never initializes.
- **Status:** FAIL

### Scenario 7: npm run stop terminates process
- **Description:** Verify `npm run stop` kills the running app
- **Steps:**
  1. Run `npm run stop` after a start attempt
- **Expected:** Process killed, PID file removed
- **Actual:** Could not fully test because the app never stays running. The stop script does execute and removes the PID file. When the PID file exists with a stale PID, it correctly falls back to pkill.
- **Status:** FAIL (blocked by Scenario 6)

### Scenario 8: npm run logs tails the log file
- **Description:** Verify `npm run logs` runs `tail -f` on the log file
- **Steps:**
  1. Check package.json for the logs script definition
- **Expected:** Runs `tail -f` on `/tmp/-Users-david-dev-chorus.log`
- **Actual:** Script is defined as `tail -f "/tmp/$(pwd | tr '/' '-').log"` which correctly resolves the log path. The log file exists but is empty because the app never produces output (see Scenario 6).
- **Status:** FAIL (blocked by Scenario 6)

### Scenario 9: Agent scripts work when app is running
- **Description:** Verify status.sh, logs.sh, curl-api.sh work when app is running
- **Steps:**
  1. Start the app using `gren run Main` (workaround for the build/chorus.js issue)
  2. Run `scripts/agent/status.sh`
  3. Run `scripts/agent/logs.sh 10`
  4. Run `scripts/agent/curl-api.sh GET /api/tasks`
  5. Kill the app
  6. Run `scripts/agent/status.sh` again
- **Expected:** status.sh reports "running", logs.sh shows log lines, curl-api.sh returns API data, status.sh reports "stopped" after kill
- **Actual:** All agent scripts function correctly when the app is actually running:
  - `status.sh` reported "running"
  - `logs.sh` showed log output from the app
  - `curl-api.sh` returned `{"data":[],"meta":{"timestamp":...}}` with HTTP 200
  - After kill, `status.sh` reported "stopped" and showed last 20 log lines
- **Status:** PASS (when tested with working app via `gren run`)

### Scenario 10: start.sh creates data directories
- **Description:** Verify start.sh creates data/registry, data/workspaces, data/uploads
- **Steps:**
  1. Review start.sh script content
  2. Verify directories exist after running start.sh
- **Expected:** Directories created
- **Actual:** start.sh has `mkdir -p "$DATA_DIR/registry" "$DATA_DIR/workspaces" "$DATA_DIR/uploads"`. Directories were created. However, start.sh times out after 30 seconds because the app never becomes ready (same root cause as Scenario 6).
- **Status:** PASS (directory creation works; timeout is due to Scenario 6 blocker)

### Scenario 11: No Docker references remain
- **Description:** Search all project files for Docker/docker references
- **Steps:**
  1. Search for "docker" or "Docker" in .md, .json, .sh, .yml files
- **Expected:** No matches
- **Actual:** No matches found in any project files.
- **Status:** PASS

### Scenario 12: .gitignore updated correctly
- **Description:** Verify .gitignore has `data` instead of `docker-data` with correct comment
- **Steps:**
  1. Read .gitignore contents
- **Expected:** `# App data` comment above `data` entry, no `docker-data` reference
- **Actual:** Comment reads `# App data`, entry is `data`, no `docker-data` reference. Note: file lacks a trailing newline (pre-existing issue, not a regression).
- **Status:** PASS

### Scenario 13: PID management consistency
- **Description:** Verify npm scripts and agent scripts both use PID file at data/.pid
- **Steps:**
  1. Review npm start script in package.json for PID file writing
  2. Review npm stop script for PID file reading
  3. Review start.sh and stop.sh for PID file handling
- **Expected:** Both paths write and read from data/.pid
- **Actual:** npm start writes PID via `echo $! > $DATA_DIR/.pid`. npm stop reads from `$(pwd)/data/.pid` and falls back to pkill. Agent start.sh writes to `$PROJECT_ROOT/data/.pid`. Agent stop.sh reads from `$PROJECT_ROOT/data/.pid` with graceful shutdown and force-kill timeout. PID management is consistent.
- **Status:** PASS

### Scenario 14: restart.sh does not redundantly source .env
- **Description:** Verify restart.sh only delegates to stop.sh and start.sh without extra .env sourcing
- **Steps:**
  1. Read restart.sh
- **Expected:** No .env sourcing, no PROJECT_ROOT variable, just calls stop.sh and start.sh
- **Actual:** restart.sh contains only shebang, `set -e`, SCRIPT_DIR derivation, and calls to `$SCRIPT_DIR/stop.sh` and `$SCRIPT_DIR/start.sh`. No .env sourcing.
- **Status:** PASS

### Scenario 15: build:all does not include Docker
- **Description:** Verify `npm run build:all` just aliases `build:app`
- **Steps:**
  1. Check package.json
- **Expected:** `"build:all": "npm run build:app"`
- **Actual:** Matches expected.
- **Status:** PASS

### Scenario 16: .claude/settings.json has no Docker permissions
- **Description:** Check that settings.json has no Docker-related entries
- **Steps:**
  1. Read .claude/settings.json and search for "docker"
- **Expected:** No Docker references
- **Actual:** No Docker references. Permissions include the new script entries (`Bash(scripts/agent/*)`, `npm run start`, `npm run stop`, `npm run logs`).
- **Status:** PASS

## Failures

### Failure 1: App cannot start with `node build/chorus.js`
- **Scenario:** Scenario 6 (npm run start)
- **Reproduction Steps:**
  1. Run `npm run build:app` (succeeds)
  2. Run `npm run start` (which executes `cd src/chorus; node build/chorus.js > LOG 2>&1 &`)
  3. Wait 5 seconds
  4. Check `ps -p $(cat data/.pid)` -- process is not running
  5. Check `/tmp/-Users-david-dev-chorus.log` -- file is empty (0 bytes)
  6. Run `curl http://localhost:8080/api/tasks` -- connection refused
- **Expected Behavior:** The app starts, binds to port 8080, and responds to HTTP requests
- **Actual Behavior:** The node process exits immediately with code 0 and produces no output. Root cause: `gren make Main --output=build/chorus.js` produces a JS module that exports `Gren.Main.init` but never calls it. The program initialization requires `this.Gren.Main.init({})` to be called after the module loads. In contrast, `gren run Main` produces a different output file (at `.gren/app`) that includes a shebang, try/catch wrapper, and the crucial auto-init line `this.Gren.Main.init({});`. When `gren run Main` is used, the app starts correctly and responds on port 8080.
- **Severity:** BLOCKER

  **Suggested fix:** Change the `build:chorus` npm script to use `gren run`-style output, or append `this.Gren.Main.init({});` to the `gren make` output, or change `npm run start` and `start.sh` to use `gren run Main` instead of `node build/chorus.js`. The simplest approach may be to update the start scripts to use `gren run Main` from the `src/chorus/` directory.

## Test Code Quality Issues

No test code was added or modified in this iteration (the changes were to package.json scripts, agent scripts, and documentation only).

## Integration Tests Added

No integration tests were applicable for this iteration. The changes involve shell scripts, npm scripts, and documentation. The existing integration tests (18 tests) all pass.

## Overall Assessment

**Decision:** FAIL

The single blocking issue is that the app cannot be started via `node build/chorus.js`. The compiled Gren output from `gren make` does not auto-initialize the program. All other aspects of the Docker removal are correctly implemented: files deleted, scripts rewritten, documentation updated, PID management made consistent, tests pass. The fix requires changing how the app is started (either using `gren run Main` or adding an init wrapper to the build output).
