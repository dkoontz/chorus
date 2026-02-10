# Developer Report

## Task
Create a distributable package by adding a `build:dist` npm script that assembles all runtime artifacts into a `dist/` directory, and update all scripts and source code to run from `dist/` instead of package-level build directories.

## Files Modified
- `package.json` - Added `build:dist` script, updated `build:all` to call `build:dist`, removed `build:copy-ui`, updated `clean` to also clean `dist/chorus`, `dist/static`, `dist/tools`
- `scripts/build-dist.sh` - **New file.** Shell script that assembles `dist/` by copying the chorus binary, UI static files, and all tool binaries (wildcard copy of executables from `packages/tools/build/`). Cleans only built artifacts, preserving `dist/data/`.
- `scripts/agent/start.sh` - Changed to run from `dist/` directory, removed explicit `CHORUS_DATA_DIR` env var (defaults to `./data` which resolves to `dist/data/`), updated PID file path to `dist/data/.pid`, updated data directory creation to `dist/data/`
- `scripts/agent/stop.sh` - Updated PID file path from `$PROJECT_ROOT/data/.pid` to `$PROJECT_ROOT/dist/data/.pid`, updated fallback `pkill` pattern from `build/chorus` to `dist/chorus`
- `scripts/agent/build.sh` - Changed from `npm run build:app` to `npm run build:dist`
- `packages/chorus/src/Main.gren` - Changed `defaultConfig.fileToolsPath` from `"./file-tools"` to `"./tools/file-tools"`
- `packages/chorus/src/Agent/Registry.gren` - Updated all `allowedTools` patterns: `"Bash(file-tools *)"` to `"Bash(tools/file-tools *)"`, `"Bash(handoff-tool *)"` to `"Bash(tools/handoff-tool *)"`, and `"Bash(file-tools *) WebSearch"` to `"Bash(tools/file-tools *) WebSearch"`
- `packages/chorus/src/Provider/ClaudeCode.gren` - Updated both default `allowedTools` fallback values from `"Bash(file-tools *)"` to `"Bash(tools/file-tools *)"` (in `buildCliArgs` and `buildShellCommand`)

## Build Status
**Status:** PASS

```
> chorus-workspace@0.1.0 build:dist
> npm run build:app && scripts/build-dist.sh

Success! Compiled 9 modules.       (UI)
Success! Compiled 7 modules.       (file-tools)
Success! Compiled 7 modules.       (handoff-tool)
Success! Compiled 3 modules.       (task-tools)
Success! Compiled 13 modules.      (chorus)
Assembling dist/...
dist/ assembled.
```

dist/ layout after build:
```
dist/
  chorus              (60MB binary)
  static/
    app.js
    index.html
    styles.css
  tools/
    file-tools
    handoff-tool
    task-tools
```

## Test Status
**Status:** PASS

```
Running 27 tests...
27 passed, 0 failed

Running 19 integration tests...
19 passed, 0 failed
```

## Implementation Notes
- The `build-dist.sh` script copies only executable files from `packages/tools/build/` using a wildcard loop with `-f` and `-x` checks. This ensures only actual tool binaries are copied (not temp files or JS artifacts), and new tools added in the future will be automatically included.
- The `clean` script removes `dist/chorus`, `dist/static`, and `dist/tools` individually rather than `dist/` entirely. This matches the task requirement that `dist/data/` must not be destroyed. However, since `dist/data/` is only created at runtime (not by the build), a full `rm -rf dist/` would also be safe if the user has not started the app.
- Comments in `Provider/ClaudeCode.gren` that use `Bash(file-tools *)` as example input to illustrate the `toolCliFlagFromAllowedTools` function were left unchanged, since they are documentation examples showing hypothetical input strings, not actual tool path references.
- Verified that `dist/data/` survives a rebuild by creating a marker file, running `build-dist.sh`, and confirming the marker persisted.

## Iteration
1
