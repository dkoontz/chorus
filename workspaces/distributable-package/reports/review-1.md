# Code Review Report

## Summary

The implementation correctly creates a distributable package system that assembles all runtime artifacts into `dist/`. All source code changes, shell script updates, and the new `build-dist.sh` script are well-implemented. Build succeeds, all 46 tests pass, the dist layout matches the specification, and `dist/data/` is preserved across rebuilds. One blocking issue found regarding the `clean` script not fully cleaning `dist/`.

## Issues Found

### BLOCKING Issues

#### Issue 1: `clean` script does not remove `dist/chorus.js` build artifact
- **File:** `package.json`
- **Line:** 23
- **Category:** Correctness
- **Description:** The `clean` script removes `dist/chorus`, `dist/static`, and `dist/tools`, but the Gren build step also produces `packages/chorus/build/chorus.js` as an intermediate artifact (it is created but only the `chorus-tmp` file is cleaned by the build script -- `chorus.js` persists). While this is not new behavior (it existed before this change), the `clean` script was modified in this change and this is a good time to note that `dist/chorus` refers to the binary file, which is correct. However, the more pressing issue is: the `clean` script explicitly removes `dist/chorus`, `dist/static`, and `dist/tools` but does not account for the possibility of a stale `dist/` directory after `packages/*/build` is removed. If `packages/*/build` is removed by the first part of clean (`rm -rf packages/*/build`) and then `build:dist` is run, it will fail because there are no built artifacts to copy. This is expected behavior for `clean`. However, the task spec says "clean script should also clean dist/ (but preserve dist/data/ or just remove everything)" and the implementation chose to preserve `dist/data/` by selectively deleting. The current approach is correct but incomplete: if additional files ever end up in `dist/` (e.g., from manual copying), they would not be cleaned. A more robust approach would be to remove `dist/chorus dist/static dist/tools` as currently done, which covers all known build outputs.

After further analysis, the current implementation does in fact clean all three categories of built artifacts (`dist/chorus`, `dist/static/`, `dist/tools/`), which matches exactly what `build-dist.sh` creates. This is correct. **Downgrading this to a non-issue.**

### Suggestions

#### Suggestion 1: Comments in ClaudeCode.gren could be updated for consistency
- **File:** `packages/chorus/src/Provider/ClaudeCode.gren`
- **Line:** 440-441, 456-457
- **Category:** Style
- **Description:** The doc comments for `toolCliFlagFromAllowedTools` and `stripParenthesizedContent` use `"Bash(file-tools *)"` as example input, while the actual default values on lines 335 and 407 now use `"Bash(tools/file-tools *)"`. The developer report correctly explains these are illustrative examples showing hypothetical input strings, not actual tool path references, so the function behavior is the same regardless. However, updating the examples to match the new real-world values would make the documentation more immediately recognizable.
- **Suggestion:** Update the doc comment examples to use `tools/file-tools` instead of `file-tools` for consistency with the actual values now used in the codebase. For example: `Example: "Bash(tools/file-tools *) Edit Read(*)" produces "Bash Edit Read"`.

#### Suggestion 2: build-dist.sh could validate that source artifacts exist before copying
- **File:** `scripts/build-dist.sh`
- **Line:** 16-24
- **Category:** Correctness
- **Description:** The script copies from `packages/chorus/build/chorus`, `packages/chorus-ui/build/app.js`, `packages/chorus-ui/static/*`, and `packages/tools/build/*` without checking that these source files exist. If `build:app` fails partway through (e.g., tools build succeeds but chorus build fails), `build-dist.sh` would still be invoked due to the `&&` chaining in `package.json` being sequential -- actually, with `&&`, a failure in `build:app` would prevent `build-dist.sh` from running. So this is a minor concern. The `set -e` at the top of the script would also cause it to abort on a failed `cp`. This is adequate.
- **Suggestion:** No change needed -- `set -e` and the `&&` chaining provide sufficient protection. This is informational only.

#### Suggestion 3: The `pkill` fallback pattern could be more specific
- **File:** `scripts/agent/stop.sh`
- **Line:** 32
- **Category:** Correctness
- **Description:** The fallback `pkill -f 'dist/chorus'` pattern would match any process with `dist/chorus` in its command line, which could potentially match unrelated processes (e.g., an editor with a file at a path containing `dist/chorus`). The original pattern `build/chorus` had the same limitation.
- **Suggestion:** Consider using a more specific pattern like `pkill -f "$PROJECT_ROOT/dist/chorus"` to scope the match to this specific project. This is a pre-existing concern that was merely carried forward, so it is low priority.

## Overall Assessment

**Decision:** APPROVED

The implementation is clean, correct, and complete. All acceptance criteria from the task spec are met:

1. `npm run build:dist` succeeds and creates `dist/` with the correct layout (chorus binary, `static/`, and `tools/`).
2. `dist/tools/` contains all tool binaries via wildcard copy with `-f` and `-x` checks.
3. `start.sh` runs the chorus binary from `dist/` (not `packages/chorus/`).
4. `stop.sh` correctly references the new PID file location and has an updated `pkill` fallback pattern.
5. Runtime data goes to `dist/data/`, not `$PROJECT_ROOT/data/`.
6. `build:all` calls `build:dist` which calls `build:app` internally.
7. `defaultConfig.fileToolsPath` is now `"./tools/file-tools"`.
8. All `allowedTools` patterns in Registry.gren reference the `tools/` prefix.
9. Both default `allowedTools` fallbacks in ClaudeCode.gren are updated.
10. All 46 tests (27 unit + 19 integration) pass.
11. Rebuilding preserves `dist/data/`.

The new `scripts/build-dist.sh` is well-structured, uses appropriate wildcard logic for tool binaries, and correctly preserves `dist/data/`. The suggestions above are minor style and robustness improvements worth considering in future work.
