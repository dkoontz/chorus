# Code Review Report

## Summary
The changes compile the chorus app into a standalone Bun binary (matching the tools build pattern), update `npm run start`/`stop` to reference the binary, and update agent scripts accordingly. The implementation is correct, consistent, and well-structured.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: pkill pattern could match build processes
- **File:** `package.json`
- **Line:** 14 (the `stop` script)
- **Category:** Correctness
- **Description:** The `pkill -f 'build/chorus'` fallback pattern could match a concurrent `bun build --compile build/chorus.js` process if a build happens to be running when stop is invoked. The same pattern appears in `scripts/agent/stop.sh` line 32.
- **Suggestion:** Use a more specific pattern like `pkill -f './build/chorus$'` (anchored to end of string) or `pkill -f 'CHORUS_DATA_DIR.*build/chorus'` to distinguish the running server from a build command. This is low-risk since the fallback only triggers when no PID file exists.

#### Suggestion 2: Intermediate chorus.js not cleaned up after binary compilation
- **File:** `package.json`
- **Line:** 9 (the `build:chorus` script)
- **Category:** Simplification
- **Description:** The `build:chorus` script removes `chorus-tmp` but leaves `chorus.js` (270KB) in the build directory. Since the standalone binary is the runtime artifact, the intermediate JS file is no longer needed after compilation.
- **Suggestion:** Add `rm build/chorus.js` at the end of the build chain, after `rm build/chorus-tmp`. Note: this is consistent with how `build:tools` also leaves `file-tools.js`, so if you choose to clean up, consider doing it for both. This is a minor disk space consideration and does not affect functionality.

## Overall Assessment

**Decision:** APPROVED

The implementation correctly follows the same build pattern as the tools binary (gren make -> strip shebang -> append init -> bun build --compile -> cleanup). The `start.sh` and `stop.sh` agent scripts are well-written with proper PID management, graceful shutdown with force-kill timeout, and stale PID file handling. Build and tests pass (23 unit, 18 integration). The two suggestions above are minor and do not need to be addressed before merge.
