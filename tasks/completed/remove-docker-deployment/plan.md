# Remove Docker Deployment

## Summary
Convert the deployment strategy from Docker-based to direct local execution as a standalone binary. Remove all Docker-related files, replace Docker scripts with direct-execution equivalents, build the chorus app as a standalone Bun binary (same pattern as the file tools), and update documentation to reflect the new workflow.

## Requirements
- Remove Docker-related files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`
- Remove Docker-specific npm scripts (`build:docker`, `docker:compose`) from `package.json`
- Replace `build:all` to no longer include Docker image build (just alias `build:app`)
- Build the chorus app as a standalone Bun binary, following the same pattern as `build:tools`: `gren make Main --output=tmp` → strip shebang with `tail -n +2` → `bun build --compile` → cleanup. The init call (`this.Gren.Main.init({});`) must be appended to the JS before compiling since the chorus Gren program type doesn't auto-init like the tools' `defineSimpleProgram`.
- Add `npm run start` script that runs the compiled binary directly, redirecting stdout/stderr to a log file in `/tmp` named after the project directory path (substituting `-` for `/`), truncating on start, and running in the background
- Add `npm run stop` script that stops the running app process
- Add `npm run logs` script that tails the log file (`tail -f`)
- Replace agent scripts that reference Docker with direct-execution equivalents:
  - `scripts/agent/build-docker.sh` - Remove (replaced by `scripts/agent/build.sh` which already exists)
  - `scripts/agent/start-docker.sh` - Rewrite as `scripts/agent/start.sh` to start the app directly, wait for ready
  - `scripts/agent/stop-docker.sh` - Rewrite as `scripts/agent/stop.sh` to kill the node process
  - `scripts/agent/restart-docker.sh` - Rewrite as `scripts/agent/restart.sh` calling stop then start
  - `scripts/agent/docker-status.sh` - Rewrite as `scripts/agent/status.sh` to check if process is running
  - `scripts/agent/docker-logs.sh` - Rewrite as `scripts/agent/logs.sh` to read from the log file
- Ensure the app uses `./data` as its default data directory (the existing `defaultConfig` already does this)
- Ensure the data directory (`./data`) and subdirectories (`registry`, `workspaces`, `uploads`) are created on start if they don't exist
- Update `.claude/settings.json` to remove Docker-related permissions and add permissions for the new scripts
- Update `CLAUDE.md` to reflect direct execution workflow
- Update `agents/developer.md` and `agents/qa.md` to reference the new script names and remove Docker instructions
- Update `.gitignore` to replace `docker-data` with `data`

## Acceptance Criteria
- [ ] `Dockerfile`, `docker-compose.yml`, and `.dockerignore` are deleted
- [ ] `npm run build:all` builds the app without attempting a Docker image build
- [ ] `npm run start` launches the app in the background, redirecting output to `/tmp/-Users-david-dev-chorus.log` (path derived from current dir, `/` replaced with `-`), truncating the log file first
- [ ] `npm run stop` kills the running app process
- [ ] `npm run logs` runs `tail -f` on the log file
- [ ] Old Docker agent scripts (`build-docker.sh`, `start-docker.sh`, `stop-docker.sh`, `restart-docker.sh`, `docker-status.sh`, `docker-logs.sh`) are removed
- [ ] New agent scripts exist: `start.sh`, `stop.sh`, `restart.sh`, `status.sh`, `logs.sh`
- [ ] `scripts/agent/start.sh` creates data directories if needed, starts the app, and waits for it to become ready (polling `/api/tasks`)
- [ ] `scripts/agent/stop.sh` stops the running app process gracefully
- [ ] `scripts/agent/status.sh` reports whether the app is running and shows recent logs if stopped
- [ ] `scripts/agent/logs.sh` shows recent log output from the log file (default 50 lines)
- [ ] `CLAUDE.md` documents the direct-execution workflow with no Docker references
- [ ] `agents/developer.md` references new script names with no Docker references
- [ ] `agents/qa.md` references new script names with no Docker references
- [ ] `.claude/settings.json` has no Docker-related permission entries
- [ ] `.gitignore` lists `data` instead of `docker-data`
- [ ] The app can be built with `npm run build:app`, started with `npm run start`, and responds on `http://localhost:8080`

## Out of Scope
- Modifying the Gren application source code (it already supports direct execution via env vars)
- Changing the `.env` / `.env.example` mechanism
- Changing how tests run
- Changing the `build.sh`, `test.sh`, or `curl-api.sh` agent scripts (they have no Docker dependency)
- Updating workspace reports or completed task files
- Updating `MEMORY.md` (user's private file, handled separately)

## Technical Context

### Log File Convention
The log file path is derived from the current working directory by replacing `/` with `-` and prepending `/tmp/`. For example, if the project root is `/Users/david/dev/chorus`, the log file would be `/tmp/-Users-david-dev-chorus.log`. The file is truncated each time the app starts.

### Files to Delete
- `Dockerfile` - No longer needed
- `docker-compose.yml` - No longer needed
- `.dockerignore` - No longer needed
- `scripts/agent/build-docker.sh` - Replaced by existing `build.sh`
- `scripts/agent/start-docker.sh` - Replaced by new `start.sh`
- `scripts/agent/stop-docker.sh` - Replaced by new `stop.sh`
- `scripts/agent/restart-docker.sh` - Replaced by new `restart.sh`
- `scripts/agent/docker-status.sh` - Replaced by new `status.sh`
- `scripts/agent/docker-logs.sh` - Replaced by new `logs.sh`

### Files to Modify
- `package.json` - Remove Docker scripts, add `start`/`stop`/`logs` scripts
- `CLAUDE.md` - Rewrite running/debugging sections for direct execution
- `agents/developer.md` - Update script table and notes
- `agents/qa.md` - Update script table and notes
- `.claude/settings.json` - Remove Docker permissions, add new script permissions
- `.gitignore` - Replace `docker-data` with `data`

### Files to Create
- `scripts/agent/start.sh` - Start app directly with node, wait for ready
- `scripts/agent/stop.sh` - Stop running app process
- `scripts/agent/restart.sh` - Stop then start
- `scripts/agent/status.sh` - Check if running, show logs if not
- `scripts/agent/logs.sh` - Show recent log output

### Related Files (reference only)
- `src/chorus/src/Main.gren` - Contains `defaultConfig` showing default paths (`./data`, `./static`, port 8080). No changes needed.
- `scripts/agent/build.sh` - Already works without Docker. No changes needed.
- `scripts/agent/test.sh` - Already works without Docker. No changes needed.
- `scripts/agent/curl-api.sh` - Already works without Docker. No changes needed.
- `.env.example` - No changes needed.
- `.claude/hooks/source-env.sh` - No changes needed.

### Patterns to Follow
- Agent scripts follow a consistent pattern: set `PROJECT_ROOT`, source `.env`, execute task. See `scripts/agent/build.sh` for reference.
- The log file name convention: take `pwd`, replace all `/` with `-`, prepend `/tmp/`, append `.log`. Example: `/tmp/-Users-david-dev-chorus.log`
- The app runs as `node build/chorus.js` from within `src/chorus/`. It reads `CHORUS_DATA_DIR` (default `./data`) and `CHORUS_STATIC_DIR` (default `./static`) from environment.
- For the npm start script, the app should be started from `src/chorus/` so that relative default paths resolve correctly. Set `CHORUS_DATA_DIR` to point to the project root's `data` directory (absolute path).

### Environment Variables for Direct Execution
When running directly (not in Docker), the app needs:
- `CHORUS_DATA_DIR` - Should point to `$PROJECT_ROOT/data` (the app defaults to `./data` relative to CWD)
- `CHORUS_STATIC_DIR` - Should point to `$PROJECT_ROOT/src/chorus/static` or the app default `./static` works if CWD is `src/chorus/`
- `CHORUS_HOST` - Default `0.0.0.0` works
- `CHORUS_PORT` - Default `8080` works
- `CHORUS_LOG_LEVEL` - Sourced from `.env`

The simplest approach: run `node build/chorus.js` from `src/chorus/` directory where the defaults (`./data`, `./static`) resolve correctly, and set `CHORUS_DATA_DIR=$PROJECT_ROOT/data` to store data at the project root level.

## Testing Requirements
- Build the app with `npm run build:app`
- Start the app with `npm run start` and verify it creates the log file and runs in the background
- Verify `npm run logs` shows output
- Verify `curl http://localhost:8080/api/tasks` returns a response
- Verify `npm run stop` terminates the process
- Run `scripts/agent/start.sh` and verify it waits for the app to become ready
- Run `scripts/agent/status.sh` and verify it reports "running"
- Run `scripts/agent/logs.sh` and verify it shows log output
- Run `scripts/agent/stop.sh` and verify the app stops
- Run `scripts/agent/status.sh` again and verify it reports "stopped"

## Notes
- The `docker-data/` directory in the project root will become unused. The new data directory is `data/` at the project root. Existing data in `docker-data/` can be manually copied to `data/` if needed, but this is not part of the automated task.
- The `.env` hook (`source-env.sh`) already auto-sources environment variables before each Bash command, so the `.env` mechanism continues to work without changes.
- The hook in `source-env.sh` blocks `&&` in commands, so npm scripts that need chaining should use separate script files or npm's built-in script chaining.
