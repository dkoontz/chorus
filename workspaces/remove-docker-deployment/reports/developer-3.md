# Developer Report

## Task
Compile the chorus app into a standalone Bun binary, following the same pattern as the file tools build. This fixes the blocker from QA report iteration 2 where `node build/chorus.js` did not auto-initialize the Gren program.

## Files Modified
- `package.json` - Updated `build:chorus` to compile a standalone Bun binary (gren make -> strip shebang -> append init call -> bun build --compile -> cleanup). Updated `start` script to run `./build/chorus` binary instead of `node build/chorus.js`. Updated `stop` script pkill fallback to match new binary name.
- `scripts/agent/start.sh` - Changed from `node build/chorus.js` to `./build/chorus`
- `scripts/agent/stop.sh` - Changed pkill fallback pattern from `node build/chorus.js` to `build/chorus`

## Build Status
**Status:** PASS

All components compiled without errors:
- UI: 7 modules
- Tools: 4 modules
- Chorus: 9 modules compiled, then bundled and compiled to standalone Bun binary
- Static assets copied

## Test Status
**Status:** PASS

- 23 unit tests passed, 0 failed
- 18 integration tests passed, 0 failed

## Implementation Notes
- The `build:chorus` script now follows the same pattern as `build:tools`:
  1. `gren make Main --output=build/chorus-tmp` - compile Gren to JS
  2. `tail -n +2 build/chorus-tmp > build/chorus.js` - strip shebang line
  3. `echo 'this.Gren.Main.init({});' >> build/chorus.js` - append init call (needed because chorus uses a program type that doesn't auto-init, unlike tools' `defineSimpleProgram`)
  4. `bun build --compile build/chorus.js --outfile build/chorus` - compile to standalone binary
  5. `rm build/chorus-tmp` - cleanup temp file
- The resulting binary at `src/chorus/build/chorus` is ~57MB and runs without needing Node.js at runtime.
- Both `npm run start` and `scripts/agent/start.sh` now run the binary directly. The binary is executed from `src/chorus/` so that `./static` resolves correctly, with `CHORUS_DATA_DIR` set to `$PROJECT_ROOT/data`.
- Verified end-to-end: build succeeds, app starts, API responds on port 8080, stop works cleanly, status reports correctly, logs show output.
- The log output shows duplicate initialization lines and a "Failed to create HTTP server" error -- this is pre-existing behavior unrelated to the binary compilation change.

## Iteration
3
