# QA Report

## Summary

All success criteria from the task specification are met. The round 2 implementation resolves both blockers from QA round 1: the Bun binary `applicationPath` issue is fixed via a build-time sed patch, and 13 unit tests have been added for the `configFromEnv` function. Static files are served correctly when the binary is run from any directory.

## Test Scenarios

### Scenario 1: Build succeeds
- **Description:** Verify `npm run build:dist` completes without errors, including the new patch-bun-compat.sh step
- **Steps:**
  1. Run `npm run build:dist` from the worktree root
- **Expected:** Build completes successfully with "Patched build/chorus.js for Bun compatibility" message; `dist/` directory is populated with binary and static files
- **Actual:** Build succeeded. Patch script ran and reported success. `dist/` contains `chorus` binary, `static/` (with app.js, index.html, styles.css), `tools/`, and `data/`
- **Status:** PASS

### Scenario 2: All tests pass
- **Description:** Verify `npm run test` passes all unit and integration tests
- **Steps:**
  1. Run `npm run test`
- **Expected:** All tests pass, including the 13 new ConfigTests
- **Actual:** 40 unit tests passed (27 existing + 13 new), 19 integration tests passed
- **Status:** PASS

### Scenario 3: Static files served when running from within dist/
- **Description:** Verify the binary serves static files when cwd is `dist/`
- **Steps:**
  1. `cd dist/`
  2. `./chorus` (background)
  3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` (expect 200)
  4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/app.js` (expect 200)
  5. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/styles.css` (expect 200)
- **Expected:** HTTP 200 for all static files
- **Actual:** HTTP 200 for index.html, app.js, and styles.css
- **Status:** PASS

### Scenario 4: Static files served when running from project root (key requirement)
- **Description:** Verify `./dist/chorus` serves the web UI when run from the project root (not from within `dist/`)
- **Steps:**
  1. `cd` to project root (parent of `dist/`)
  2. `./dist/chorus` (background)
  3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` (expect 200)
  4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/app.js` (expect 200)
  5. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/styles.css` (expect 200)
- **Expected:** HTTP 200 for all static files
- **Actual:** HTTP 200 for index.html, app.js, and styles.css
- **Status:** PASS

### Scenario 5: Static files served when running from an unrelated directory
- **Description:** Verify the binary serves static files when invoked via absolute path from a completely unrelated directory (`/tmp`)
- **Steps:**
  1. `cd /tmp`
  2. `/Users/david/dev/chorus.worktrees/fix-static-file-serving/dist/chorus` (background)
  3. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` (expect 200)
  4. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/app.js` (expect 200)
  5. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/styles.css` (expect 200)
- **Expected:** HTTP 200 for all static files
- **Actual:** HTTP 200 for index.html, app.js, and styles.css
- **Status:** PASS

### Scenario 6: API endpoints work from project root
- **Description:** Verify API endpoints function when binary is run from project root
- **Steps:**
  1. Run `./dist/chorus` from project root (background)
  2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/agents`
- **Expected:** HTTP 200
- **Actual:** HTTP 200
- **Status:** PASS

### Scenario 7: Environment variable override takes precedence (positive)
- **Description:** Verify CHORUS_STATIC_DIR override takes precedence over binary-relative default
- **Steps:**
  1. Run `CHORUS_STATIC_DIR=/Users/david/.../dist/static /Users/david/.../dist/chorus` from `/tmp`
  2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` (expect 200)
- **Expected:** HTTP 200 for static files (env var path overrides binary-relative default)
- **Actual:** HTTP 200
- **Status:** PASS

### Scenario 8: Environment variable override takes precedence (negative)
- **Description:** Verify CHORUS_STATIC_DIR set to a non-existent path causes 404, proving the override is actually used
- **Steps:**
  1. Run `CHORUS_STATIC_DIR=/nonexistent/path ./dist/chorus` from project root
  2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/` (expect 404)
- **Expected:** HTTP 404 (env var points to non-existent directory)
- **Actual:** HTTP 404
- **Status:** PASS

### Scenario 9: Nonexistent static file returns 404
- **Description:** Verify a request for a nonexistent static file returns 404
- **Steps:**
  1. With server running, `curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/nonexistent.js`
- **Expected:** HTTP 404
- **Actual:** HTTP 404
- **Status:** PASS

### Scenario 10: HTML content is correct
- **Description:** Verify the served index.html contains the expected structure
- **Steps:**
  1. `curl -s http://localhost:8080/`
  2. Inspect the HTML content
- **Expected:** Valid HTML with script and stylesheet references
- **Actual:** HTML document with `<link rel="stylesheet" href="/styles.css">`, `<script src="/app.js">`, and Gren initialization code. Size is 469 bytes.
- **Status:** PASS

## Failures

None.

## Test Code Quality Issues

### Issue 1: testDataDirSubpaths checks multiple assertions
- **File:** `packages/chorus/tests/unit/ConfigTests.gren`
- **Line:** 209-231
- **Problem:** This test checks four fields (`registryRoot`, `workspacesRoot`, `uploadDir`, `agentsRoot`) in a single assertion using `&&`. If any one fails, the error message shows all four values but does not clearly indicate which specific comparison failed. The QA standards recommend single assertion per test.
- **Suggestion:** Split into four separate tests (one per subpath), each using `expectEqual` for a clear, pinpointed failure message. Alternatively, since the error message does dump all values, this is acceptable as a "consistency" test but is less precise than individual assertions.

### Issue 2: testAbsoluteBaseDir checks multiple assertions
- **File:** `packages/chorus/tests/unit/ConfigTests.gren`
- **Line:** 234-254
- **Problem:** Same pattern as Issue 1 -- checks three fields (`staticRoot`, `registryRoot`, `chorusToolsPath`) in a single compound assertion. Overlaps with the individual `testBaseDirAppliedTo*` tests that already check each of these paths separately with `/opt/app` as baseDir. The only difference is the baseDir value (`/usr/local/bin` vs `/opt/app`), so this test adds marginal value beyond confirming string concatenation works with a different prefix.
- **Suggestion:** This is not a significant issue since the individual field tests already exist. If kept, consider splitting the compound check into individual assertions for clarity.

### Issue 3: No test for invalid CHORUS_PORT value
- **File:** `packages/chorus/tests/unit/ConfigTests.gren`
- **Problem:** There is no test verifying that an invalid `CHORUS_PORT` value (e.g., `"abc"`) falls back to the default port. The `configFromEnv` function uses `String.toInt` with `Maybe.withDefault`, which should produce the default on invalid input, but this behavior is not verified.
- **Suggestion:** Add a test: `configFromEnv "." (Dict.set "CHORUS_PORT" "abc" Dict.empty) defaultConfig` should produce `serverPort = 8080`.

## Integration Tests Added

No file-tool integration tests were added. The QA standards' integration test framework (`packages/tools/tests/integration/*.json`) is designed for the file-based CLI tools, not for HTTP server behavior. The 13 unit tests in `ConfigTests.gren` are the appropriate test type for the `configFromEnv` path resolution logic. The functional behavior of static file serving was verified through manual end-to-end testing (scenarios 3-10 above).

| Test Name | File | Validates |
| --- | --- | --- |
| N/A - not applicable to file tools test framework | N/A | Server-level feature tested via unit tests and manual HTTP verification |

## Overall Assessment

**Decision:** PASS

All 8 success criteria from the task specification are met:
1. Default `staticRoot` is computed as `<binary_parent>/static` -- verified via unit tests and manual HTTP testing
2. Default `dataDir` is computed as `<binary_parent>/data` -- verified via unit tests
3. Default `chorusToolsPath` is computed as `<binary_parent>/tools/chorus-tools` -- verified via unit tests
4. Environment variable overrides still take precedence -- verified via positive and negative override tests (scenarios 7-8)
5. Running the binary from a different directory than `dist/` serves the web UI correctly -- verified from project root (scenario 4) and from `/tmp` (scenario 5)
6. Running the binary from within `dist/` continues to work -- verified (scenario 3)
7. `npm run build:all` succeeds -- verified (scenario 1)
8. `npm run test` passes -- verified with 40 unit + 19 integration tests (scenario 2)

Non-blocking observations:
- The Bun compatibility patch (`scripts/patch-bun-compat.sh`) uses macOS-specific `sed -i ''` syntax, as noted in review-2. This would need adjustment for Linux CI environments.
- Two unit tests (`testDataDirSubpaths`, `testAbsoluteBaseDir`) use compound assertions rather than single assertions per test, which makes failure diagnosis slightly less precise.
- No test exists for invalid `CHORUS_PORT` fallback behavior.
