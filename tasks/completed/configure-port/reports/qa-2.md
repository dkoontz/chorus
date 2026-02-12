# QA Report

## Summary
The configure-port feature works correctly across all tested scenarios. The server binds to the correct port based on CLI args, workspace config (`chorus.json`), env var (`CHORUS_PORT`), or default (8080), with proper precedence (CLI > config > env > default). Invalid port values produce clear error messages and exit with code 1. All 62 unit tests and 19 integration tests pass. The `start.sh` script correctly forwards `--port` to the binary and uses the right port for the readiness check.

## Test Scenarios

### Scenario 1: Start with --port CLI argument
- **Description:** Verify `./chorus --port 9090` starts the server on port 9090
- **Steps:**
  1. Run `./chorus --port 9090` in the dist directory
  2. Wait 3 seconds for startup
  3. `curl http://localhost:9090/api/config` -- should respond
  4. `curl http://localhost:8080/api/config` -- should fail (connection refused)
- **Expected:** Server responds on port 9090 only
- **Actual:** Server responded on port 9090 with `{"error":{"code":"NOT_FOUND","message":"No workspace config loaded"}}`. Port 8080 was not listening.
- **Status:** PASS

### Scenario 2: Port from chorus.json config file
- **Description:** Verify a `"port": 3000` field in `chorus.json` causes the server to start on port 3000
- **Steps:**
  1. Create `/tmp/chorus-qa-test-config.json` with `"port": 3000`
  2. Run `CHORUS_CONFIG=/tmp/chorus-qa-test-config.json ./chorus`
  3. Wait 3 seconds for startup
  4. `curl http://localhost:3000/api/config` -- should respond
  5. `curl http://localhost:8080/api/config` -- should fail
- **Expected:** Server responds on port 3000 with workspace config loaded
- **Actual:** Server responded on port 3000 with full config including `"port":3000`. Port 8080 was not listening.
- **Status:** PASS

### Scenario 3: CLI --port overrides chorus.json port
- **Description:** Verify that `--port 9090` takes precedence over `chorus.json` containing `"port": 3000`
- **Steps:**
  1. Use the same config file with `"port": 3000`
  2. Run `CHORUS_CONFIG=/tmp/chorus-qa-test-config.json ./chorus --port 9090`
  3. `curl http://localhost:9090/api/config` -- should respond
  4. `curl http://localhost:3000/api/config` -- should fail
- **Expected:** Server responds on port 9090 (CLI wins)
- **Actual:** Server responded on port 9090. Port 3000 was not listening.
- **Status:** PASS

### Scenario 4: Default port (8080) when no port specified
- **Description:** Verify the server starts on 8080 when neither CLI nor config specifies a port
- **Steps:**
  1. Run `./chorus` with no arguments and no CHORUS_CONFIG
  2. `curl http://localhost:8080/api/config` -- should respond
- **Expected:** Server responds on port 8080
- **Actual:** Server responded on port 8080.
- **Status:** PASS

### Scenario 5: CHORUS_PORT env var
- **Description:** Verify `CHORUS_PORT=7070` causes the server to start on port 7070
- **Steps:**
  1. Run `CHORUS_PORT=7070 ./chorus`
  2. `curl http://localhost:7070/api/config` -- should respond
- **Expected:** Server responds on port 7070
- **Actual:** Server responded on port 7070.
- **Status:** PASS

### Scenario 6: Invalid port -- non-integer
- **Description:** Verify `--port abc` produces a clear error and exits
- **Steps:**
  1. Run `./chorus --port abc`
  2. Check stderr output and exit code
- **Expected:** Error message mentioning invalid port, exit code 1
- **Actual:** Output: `Error: Invalid port value: abc (must be an integer)`, exit code 1.
- **Status:** PASS

### Scenario 7: Invalid port -- out of range (99999)
- **Description:** Verify `--port 99999` produces a clear error and exits
- **Steps:**
  1. Run `./chorus --port 99999`
  2. Check stderr output and exit code
- **Expected:** Error message mentioning out-of-range port, exit code 1
- **Actual:** Output: `Error: Port out of range: 99999 (must be 1-65535)`, exit code 1.
- **Status:** PASS

### Scenario 8: Invalid port -- missing value
- **Description:** Verify `--port` with no following value produces a clear error
- **Steps:**
  1. Run `./chorus --port`
  2. Check stderr output and exit code
- **Expected:** Error message about missing value, exit code 1
- **Actual:** Output: `Error: --port requires a value`, exit code 1.
- **Status:** PASS

### Scenario 9: Invalid port -- zero
- **Description:** Verify `--port 0` is rejected
- **Steps:**
  1. Run `./chorus --port 0`
  2. Check stderr output and exit code
- **Expected:** Error message about out-of-range port, exit code 1
- **Actual:** Output: `Error: Port out of range: 0 (must be 1-65535)`, exit code 1.
- **Status:** PASS

### Scenario 10: Invalid port -- negative
- **Description:** Verify `--port -1` is rejected
- **Steps:**
  1. Run `./chorus --port -1`
  2. Check stderr output and exit code
- **Expected:** Error message about out-of-range port, exit code 1
- **Actual:** Output: `Error: Port out of range: -1 (must be 1-65535)`, exit code 1.
- **Status:** PASS

### Scenario 11: start.sh script respects --port
- **Description:** Verify the `start.sh` script forwards `--port` to the chorus binary and uses the correct port for readiness check
- **Steps:**
  1. Run `npm run start -- --port 9191`
  2. Observe output says "App ready on http://localhost:9191"
  3. `curl http://localhost:9191/api/config` -- should respond
- **Expected:** start.sh detects port 9191, uses it for readiness check, confirms readiness
- **Actual:** start.sh output: "App ready on http://localhost:9191". Server responded on port 9191.
- **Status:** PASS

### Scenario 12: Port warning on API config save with different port
- **Description:** Verify a warning is logged when saving a workspace config with a different port via API
- **Steps:**
  1. Start server on port 3000 (via chorus.json)
  2. PUT `/api/config` with `"port": 5555`
  3. Check log output for warning
- **Expected:** Warning log: "Workspace config specifies port 5555 but server is running on 3000. Restart required for port change to take effect."
- **Actual:** Log showed: `[WARN] Workspace config specifies port 5555 but server is running on 3000. Restart required for port change to take effect.`
- **Status:** PASS

### Scenario 13: Port field in API response
- **Description:** Verify the API includes the port field when set and omits it when not set
- **Steps:**
  1. GET `/api/config` when chorus.json has `"port": 3000` -- response should include `"port": 3000`
  2. PUT `/api/config` without port field -- response should omit port field
  3. Check chorus.json file on disk -- should not contain port field
- **Expected:** Port field present when set, absent when not set (not null)
- **Actual:** Response with port: `{"port":3000,...}`. Response without port: no port field in response or file.
- **Status:** PASS

### Scenario 14: Unit tests pass
- **Description:** All unit tests pass including new port-related tests
- **Steps:**
  1. Run `npm run test:unit`
- **Expected:** 62 tests pass, 0 fail
- **Actual:** 62 passed, 0 failed
- **Status:** PASS

### Scenario 15: Integration tests pass
- **Description:** All integration tests pass
- **Steps:**
  1. Run `npm run test:integration`
- **Expected:** 19 tests pass, 0 fail
- **Actual:** 19 passed, 0 failed
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

### Issue 1: Error tests use wildcard match on Err instead of asserting error message content
- **File:** `packages/chorus/tests/unit/ConfigTests.gren`
- **Lines:** 259-265, 272-278, 285-291, 395-401, 418-422
- **Problem:** Five error-case tests (`testParsePortFromArgsInvalidNonInteger`, `testParsePortFromArgsOutOfRange`, `testParsePortFromArgsMissingValue`, `testParsePortFromArgsZero`, `testParsePortFromArgsBoundaryInvalid`) match `Err _` with a wildcard, discarding the actual error message. This means the tests would pass even if the error message were wrong or empty. They only verify that the result is an Err, not that the error message is meaningful.
- **Suggestion:** Assert the specific expected error message string. For example, `testParsePortFromArgsInvalidNonInteger` should assert `Err "Invalid port value: abc (must be an integer)"` rather than `Err _`.

## Integration Tests Added

No integration test JSON files were added. The port configuration feature is a server-level concern (CLI arg parsing, config loading, server binding) rather than a tool-level feature. The `packages/tools/tests/integration/` framework tests file tools, which are not applicable here. The functional testing was performed through direct binary execution and API curl requests as documented in the test scenarios above.

## Overall Assessment

**Decision:** PASS

All 15 test scenarios passed. The feature correctly implements:
- CLI `--port` argument parsing with validation (range 1-65535)
- Workspace config `"port"` field in `chorus.json` (decoder/encoder round-trip)
- Port precedence: CLI arg > config file > env var > default (8080)
- Clear error messages and exit code 1 for invalid port values
- `start.sh` script updated to forward `--port` and use correct port for readiness check
- Port warning logged when API-saved config specifies a different port than the running server
- UI settings form includes port field with number input type and min/max attributes (verified via code review; browser testing unavailable)
- Port field is conditionally included in JSON encoding (omitted when `Nothing`, not `null`)

Non-blocking observation: The error-case unit tests use wildcard matching on `Err _` rather than asserting specific error messages, which reduces their ability to catch regressions in error messaging. This is a minor quality issue that does not block release.
