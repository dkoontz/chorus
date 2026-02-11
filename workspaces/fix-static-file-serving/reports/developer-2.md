# Developer Report

## Task
Fix the two failures identified in QA iteration 1:
1. `env.applicationPath` returns incorrect value (`chorus.js` instead of the full binary path) in Bun-compiled binaries, causing static file serving to fail when running from outside the `dist/` directory.
2. No unit tests were added for the `configFromEnv` feature.

## Files Modified
- `packages/chorus/src/Config.gren` - **New file.** Extracted `Config` type alias, `defaultConfig`, and `configFromEnv` from `Main.gren` into a standalone module so it can be imported by unit tests.
- `packages/chorus/src/Main.gren` - Removed `Config` type alias, `defaultConfig`, and `configFromEnv` (now in `Config.gren`). Added `import Config exposing (Config)` and updated references to use `Config.configFromEnv` and `Config.defaultConfig`.
- `scripts/patch-bun-compat.sh` - **New file.** Build-time patch script that replaces `typeof module !== "undefined" ? module.filename : process.execPath` with `process.execPath` in the compiled JS before Bun compilation. This fixes the root cause: in Bun-compiled binaries, `module.filename` returns only the original source filename (e.g., `chorus.js`), while `process.execPath` correctly returns the absolute path to the compiled binary.
- `package.json` - Updated `build:chorus` script to invoke `scripts/patch-bun-compat.sh` after Gren compilation and before Bun compilation. Also changed cleanup to remove `build/chorus.js` instead of `build/chorus-tmp` (since the tmp file is removed before patching).
- `packages/chorus/tests/unit/ConfigTests.gren` - **New file.** 13 unit tests for `configFromEnv` covering: baseDir-relative path computation, env var overrides for all config paths (static, data, tools, upload, host, port, log level), data directory sub-path consistency, and absolute path resolution.
- `packages/chorus/tests/unit/TestRunner.gren` - Added `ConfigTests` import and included `ConfigTests.tests` in the test runner.

## Build Status
**Status:** PASS

```
Success! Compiled 22 modules.
    Main --> build/chorus-tmp
Patched build/chorus.js for Bun compatibility
   [8ms]  bundle  1 modules
  [64ms] compile  build/chorus
Assembling dist/...
dist/ assembled.
```

## Test Status
**Status:** PASS

```
Running 40 tests...
40 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Manual Verification

Verified all QA scenarios that previously failed:

- **Scenario 4 (key requirement):** Running `./dist/chorus` from the project root now serves static files correctly. `curl http://localhost:8080/` returns 200. `curl http://localhost:8080/app.js` returns 200. `curl http://localhost:8080/styles.css` returns 200.
- **Scenario 3:** Running `./chorus` from within `dist/` continues to work. Both `index.html` and `app.js` return 200.
- **Scenario 5:** API endpoints (`/api/agents`) return 200 from both locations.
- **Scenario 6:** Environment variable override `CHORUS_STATIC_DIR=./dist/static ./dist/chorus` returns 200 for static files.

## Implementation Notes
- **Root cause of QA failure:** The Gren runtime resolves `env.applicationPath` using `typeof module !== "undefined" ? module.filename : process.execPath`. In Bun-compiled binaries, `module` is defined but `module.filename` returns only the original source filename (e.g., `"chorus.js"`), not the full binary path. `Path.parentPath` on `"chorus.js"` returns `Nothing`, so the `Maybe.withDefault "."` fallback always activates, making the iteration 1 change a no-op.
- **Fix approach:** A build-time patch replaces the ternary with `process.execPath`, which correctly returns the absolute path to the compiled binary in Bun. This is applied after Gren compilation and before Bun compilation, keeping the source code clean while fixing the runtime behavior.
- **Module extraction:** `Config`, `defaultConfig`, and `configFromEnv` were extracted from `Main.gren` into a new `Config.gren` module. This is necessary because `Main.gren` is an application entry point and cannot be imported by test modules. The extraction also improves modularity.
- The `patch-bun-compat.sh` script includes a verification step that fails the build if `module.filename` is still present after patching, providing a safety net against Gren runtime changes that might alter the generated code pattern.

## Iteration
2
