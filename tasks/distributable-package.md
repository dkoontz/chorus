# Create Distributable Package

## Summary

Create an npm script that builds Chorus and assembles all runtime artifacts into a `dist/` directory at the project root. Update all npm scripts and agent scripts to always run the chorus binary from `dist/`, cleanly separating source/build files from runtime files. Tools live in a `tools/` subdirectory within dist.

## dist/ Layout

```
dist/
  chorus              # main binary
  static/             # web UI files
    index.html
    styles.css
    app.js
  tools/              # all tool binaries
    file-tools
    handoff-tool
    task-tools
    (any future tools)
  data/               # created at runtime, NOT by build
    registry/
    workspaces/
    uploads/
    .pid
```

## Requirements

### 1. New `build:dist` npm script

- Builds everything (`build:app`), then assembles into `dist/`
- Copies chorus binary from `packages/chorus/build/chorus` to `dist/chorus`
- Copies UI files to `dist/static/` (from `packages/chorus-ui/build/app.js` and `packages/chorus-ui/static/*`)
- Copies **all** binaries from `packages/tools/build/` into `dist/tools/` (wildcard, not a hardcoded list)
- Must not delete `dist/data/` when rebuilding (only clean built artifacts: `dist/chorus`, `dist/static/`, `dist/tools/`)
- `dist/` is already in `.gitignore`

### 2. Update `scripts/agent/start.sh`

Current behavior:
```bash
cd "$PROJECT_ROOT/packages/chorus"
CHORUS_DATA_DIR="$DATA_DIR" ./build/chorus > "$LOG_FILE" 2>&1 &
echo $! > "$PROJECT_ROOT/data/.pid"
```

New behavior:
```bash
cd "$PROJECT_ROOT/dist"
./chorus > "$LOG_FILE" 2>&1 &
echo $! > "$PROJECT_ROOT/dist/data/.pid"
```

- Run from `dist/` instead of `packages/chorus/`
- Run `./chorus` instead of `./build/chorus`
- No explicit `CHORUS_DATA_DIR` needed — default `./data` resolves to `dist/data/`
- PID file goes to `dist/data/.pid`
- Data directory creation (`mkdir -p`) moves to `dist/data/{registry,workspaces,uploads}`

### 3. Update `scripts/agent/stop.sh`

- PID file path changes from `$PROJECT_ROOT/data/.pid` to `$PROJECT_ROOT/dist/data/.pid`
- Fallback `pkill` pattern should match the new binary location

### 4. Update `scripts/agent/build.sh`

- Should run `build:dist` (which includes `build:app`) instead of just `build:app`

### 5. Update `package.json` scripts

- Add `build:dist` script
- `build:all` should call `build:dist` (which calls `build:app` internally)
- Remove `build:copy-ui` — dist assembly replaces this (UI files are copied directly to `dist/static/`)
- `clean` script should also clean `dist/` (but preserve `dist/data/` or just remove everything)

### 6. Source code changes

Because tools move from `./` to `./tools/`, the chorus source must be updated:

1. **`packages/chorus/src/Main.gren`** — Change `defaultConfig.fileToolsPath` from `"./file-tools"` to `"./tools/file-tools"`
2. **`packages/chorus/src/Agent/Registry.gren`** — Update all `allowedTools` patterns:
   - `"Bash(file-tools *)"` → `"Bash(tools/file-tools *)"`
   - `"Bash(handoff-tool *)"` → `"Bash(tools/handoff-tool *)"`
   - (all occurrences)
3. **`packages/chorus/src/Provider/ClaudeCode.gren`** — Update default `allowedTools` fallback from `"Bash(file-tools *)"` to `"Bash(tools/file-tools *)"` (lines 335, 407)

## Files to Modify

- `package.json` — Add `build:dist`, update `build:all`, remove `build:copy-ui`, update `clean`
- `scripts/agent/start.sh` — Run from `dist/`, update PID/data paths
- `scripts/agent/stop.sh` — Update PID file path and pkill pattern
- `scripts/agent/build.sh` — Call `build:dist` instead of `build:app`
- `packages/chorus/src/Main.gren` — Update `defaultConfig.fileToolsPath`
- `packages/chorus/src/Agent/Registry.gren` — Update `allowedTools` patterns
- `packages/chorus/src/Provider/ClaudeCode.gren` — Update default `allowedTools` fallback

## Files NOT Modified

These scripts don't reference build paths or data locations, so they should work unchanged:
- `scripts/agent/restart.sh` — Just calls stop.sh + start.sh
- `scripts/agent/status.sh` — Checks HTTP endpoint, reads log file
- `scripts/agent/logs.sh` — Reads log file (log path is unchanged)
- `scripts/agent/test.sh` — Runs npm test commands
- `scripts/agent/curl-api.sh` — Hits HTTP endpoint

## Acceptance Criteria

- [ ] `npm run build:dist` succeeds and creates `dist/` with chorus binary, `static/`, and `tools/`
- [ ] `dist/tools/` contains all tool binaries from `packages/tools/build/` (wildcard copy)
- [ ] `npm run start` runs the chorus binary from `dist/` (not `packages/chorus/`)
- [ ] `npm run stop` correctly finds and stops the process
- [ ] Runtime data is created in `dist/data/`, not in `$PROJECT_ROOT/data/`
- [ ] `npm run build:all` produces a working dist (includes the dist assembly step)
- [ ] Default `fileToolsPath` in source is `./tools/file-tools`
- [ ] All `allowedTools` patterns in source reference `tools/` prefix
- [ ] `npm run test` passes after all changes
- [ ] Rebuilding (`npm run build:dist`) does not destroy `dist/data/`

## Out of Scope

- Cross-platform packaging (.deb, .rpm, .dmg)
- Version numbering or release tagging
- Creating a run/start script inside dist

## Testing Requirements

- Run `npm run build:dist` and verify all expected files exist in `dist/`
- Run `npm run start` and verify the app starts and is accessible at http://localhost:8080
- Run `npm run stop` and verify the app stops cleanly
- Run `npm run test` to ensure existing tests still pass after source changes
- Verify `dist/data/` is created at runtime and persists across rebuilds
