# Code Review Report

## Summary
The implementation is well-structured and covers the requirements thoroughly. There is one blocking issue related to the workspace config port being applied after the server has already started (the port change has no effect), and several minor suggestions.

## Issues Found

### BLOCKING Issues

#### Issue 1: Workspace config port is applied after the server has already started
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1252-1255 (in `GotConfigLoaded` handler) and 238-248 (in `init`)
- **Category:** Correctness
- **Description:** In `init`, the server is created via `Server.createServer` in a `Cmd.batch` alongside the `configCmd` that loads the workspace config. Both run concurrently. The server binds to the port from the current config (CLI > env var > default). When `GotConfigLoaded` fires later, it calls `Config.applyWorkspacePort` to update `model.config.serverPort`, but the HTTP server is already listening on the original port. The updated config value is stored in the model but the server is never recreated on the new port. This means `chorus.json` port settings are silently ignored at startup when using `CHORUS_CONFIG`.

  The task notes explicitly call this out: "Consider using `Init.awaitTask` to load the config file before creating the server, rather than the current parallel `Cmd.batch` approach."

  The workspace config port will work correctly for the UI display and for constructing `baseUrl` strings for providers (since those read from `model.config.serverPort`), but the server itself will not be listening on the workspace config port.

- **Suggestion:** When `CHORUS_CONFIG` is set, load and parse the workspace config file in the `init` chain (using `Init.awaitTask`) before creating the server. Apply the workspace config port to the config before passing it to `Server.createServer`. This ensures the server starts on the correct port. For dynamically loaded configs (via API), this is less critical since the server is already running, but at minimum a log warning should indicate that the port setting requires a restart to take effect.

### Suggestions

#### Suggestion 1: Variable name `port_` in decoder lambda could use a more descriptive name
- **File:** `packages/shared/Types.gren`
- **Line:** 1382
- **Category:** Style
- **Description:** The lambda parameter is named `port_` in `Decode.map (\port_ -> { config | serverPort = port_ })`. While `port_` is acceptable in a lambda binding (it is a local variable, not a record field), using a name like `portValue` or `maybePort` would be clearer and more consistent with the project's coding standard on descriptive names. The underscore suffix style is typically reserved for library boundary fields per the coding standards.
- **Suggestion:** Rename to `portValue` or `maybePort`: `Decode.map (\maybePort -> { config | serverPort = maybePort })`

#### Suggestion 2: Port error does not actually terminate the process
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 216-229
- **Category:** Correctness
- **Description:** When `portResult` is `Err`, the code calls `Node.setExitCode 1` and writes to stderr, but then the outer `when portResult is` block only runs `portErrorCmd` -- it does not start the server. This is correct behavior (the server won't start). However, `Node.setExitCode` only sets the exit code; it does not terminate the process. The Gren runtime will continue running with the Elm Architecture loop. Since no server or subscriptions are created in the error path, the process should exit naturally, but this is somewhat implicit. Consider verifying that the process actually exits when an invalid port is given.
- **Suggestion:** This may work in practice because no subscriptions are registered and no commands generate further messages. But it would be worth adding an integration test that verifies `./chorus --port abc` actually exits with a non-zero code.

#### Suggestion 3: `parsePortFromArgs` silently accepts port 0
- **File:** `packages/chorus/src/Config.gren`
- **Line:** 125
- **Category:** Correctness
- **Description:** The range check is `portNum >= 1 && portNum <= 65535`, which correctly rejects port 0. However, negative port values would be rejected by `String.toInt` returning `Nothing` for strings like "-1" depending on the implementation. This is likely fine, but the test suite does not cover port 0 or negative values.
- **Suggestion:** Consider adding test cases for edge values: `--port 0`, `--port -1`, and `--port 65535` (boundary valid), `--port 65536` (boundary invalid).

#### Suggestion 4: `input type="text"` for port field could use `type="number"`
- **File:** `packages/chorus-ui/src/View/SystemSettings.gren`
- **Line:** 166
- **Category:** Style
- **Description:** The port input field uses `type_ "text"`. Using `type_ "number"` with appropriate min/max attributes would provide better browser-level validation and a more appropriate input widget (numeric keyboard on mobile, increment/decrement controls).
- **Suggestion:** Change to `type_ "number"` and consider adding `Html.Attributes.min "1"` and `Html.Attributes.max "65535"`.

#### Suggestion 5: Test coverage for WorkspaceConfig decoder with port field
- **File:** `packages/chorus/tests/unit/ConfigTests.gren`
- **Line:** N/A
- **Category:** Correctness
- **Description:** The task specification calls for "Unit tests for `WorkspaceConfig` decoder with and without the `port` field." The current tests cover CLI arg parsing and port precedence logic well (11 new tests), but there are no tests that exercise `workspaceConfigDecoder` with JSON that includes a `"port"` field and JSON that omits it. The decoder itself appears correct (`Decode.maybe` handles the absent case), but explicit decoder tests would verify the round-trip behavior and protect against future regressions.
- **Suggestion:** Add tests that decode a JSON object with `"port": 3000` and verify `serverPort == Just 3000`, and decode one without the `port` field to verify `serverPort == Nothing`.

## Overall Assessment

**Decision:** CHANGES REQUESTED

The blocking issue must be addressed: when `CHORUS_CONFIG` is set, the workspace config port value is loaded asynchronously after the server has already started, so the server never actually binds to the port specified in `chorus.json`. The task's acceptance criteria states that "A `port` field in `chorus.json` (e.g., `"port": 3000`) causes the server to start on that port," which is not satisfied by the current implementation when using `CHORUS_CONFIG` for auto-loading.

The suggestions are worth considering but are not blocking. The implementation is otherwise clean, well-organized, follows existing patterns, and has good test coverage for the CLI arg parsing and precedence logic.
