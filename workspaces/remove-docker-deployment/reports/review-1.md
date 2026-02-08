# Code Review Report

## Summary
The implementation correctly removes all Docker-related files and replaces them with direct execution equivalents. The code is clean, follows existing project patterns, and builds/tests pass. There are two blocking issues around PID management inconsistency and a misleading gitignore comment, plus a few minor suggestions.

## Issues Found

### BLOCKING Issues

#### Issue 1: PID management mismatch between npm scripts and agent scripts
- **File:** `package.json` (line 13-14) and `scripts/agent/start.sh` (line 19), `scripts/agent/stop.sh`
- **Line:** package.json:13-14, start.sh:19, stop.sh:7-36
- **Category:** Correctness
- **Description:** The `npm run start` script does not write a PID file, while `scripts/agent/start.sh` writes the PID to `data/.pid`. The `npm run stop` script uses `pkill -f` (no PID file), while `scripts/agent/stop.sh` reads from the PID file and falls back to `pkill`. This creates two problems:
  1. If a user starts with `npm run start` and an agent later runs `stop.sh`, it won't find a PID file and will fall back to `pkill` — which works but prints "stale PID file" or uses a less precise fallback.
  2. If an agent starts with `start.sh` and the user runs `npm run stop`, the PID file at `data/.pid` is left behind as a stale file. A subsequent `stop.sh` call would try to `kill` a non-existent PID, print "stale PID file", and clean up — functional but confusing.
- **Suggestion:** Have `npm run start` also write the PID to `data/.pid` (using `echo $! > data/.pid` after the backgrounded process), and have `npm run stop` also remove the PID file. This keeps both paths consistent. Alternatively, have the agent scripts not use a PID file and rely on `pkill` like the npm scripts do, keeping things simple.

#### Issue 2: Misleading gitignore comment
- **File:** `.gitignore`
- **Line:** 15-16
- **Category:** Naming
- **Description:** The comment `# Testing` above the `data` entry is misleading. The `data` directory is the app's persistent data directory (registry, workspaces, uploads), not a testing artifact. This was likely carried over from when the previous `docker-data` entry was in this section.
- **Suggestion:** Change the comment to `# App data` or `# Runtime data` to accurately describe what the `data` directory contains.

### Suggestions

#### Suggestion 1: Redundant `.env` sourcing in `restart.sh`
- **File:** `scripts/agent/restart.sh`
- **Line:** 5
- **Category:** Simplification
- **Description:** `restart.sh` sources `.env` on line 5, but both `stop.sh` and `start.sh` (which it calls) also source `.env` themselves. The sourcing in `restart.sh` is unnecessary since the script doesn't use any env vars directly — it only calls the other two scripts.
- **Suggestion:** Remove the `.env` sourcing line from `restart.sh` since it serves no purpose. That said, this is a minor consistency issue — having it doesn't cause harm, and it matches the pattern of the other scripts.

#### Suggestion 2: `status.sh` only checks HTTP, not process existence
- **File:** `scripts/agent/status.sh`
- **Line:** 9
- **Category:** Correctness
- **Description:** `status.sh` determines if the app is running solely by checking `curl -sf http://localhost:8080/api/tasks`. If the app process is running but hasn't started listening yet (e.g., during startup), or if the process has hung without exiting, this will report "stopped" even though the process is alive. Conversely, if another service is listening on port 8080, it would falsely report "running."
- **Suggestion:** Consider also checking the PID file (if the PID management is made consistent per blocking issue 1) or checking `pgrep -f 'node build/chorus.js'` as an additional signal. The HTTP check is fine as the primary check, but a process-level check could provide a more accurate status during transitions.

#### Suggestion 3: `npm run stop` pattern match could be more specific
- **File:** `package.json`
- **Line:** 14
- **Category:** Correctness
- **Description:** `pkill -f 'node build/chorus.js'` matches any process whose command line contains `node build/chorus.js`. If someone happens to be running a different project with a similarly named file, or if the string appears in another process's arguments, it could kill the wrong process. This is unlikely in practice but worth noting.
- **Suggestion:** This is a low-risk concern and acceptable for a local development tool. No change needed unless the PID-based approach from blocking issue 1 is adopted, which would make this moot.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issues that must be addressed:
1. PID management should be consistent between `npm run start`/`npm run stop` and the agent scripts (`start.sh`/`stop.sh`). Either both should use PID files, or neither should. The current split creates confusion and potential for stale state.
2. The `.gitignore` comment "# Testing" should be corrected to accurately describe the `data` directory.
