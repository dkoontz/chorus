# Task: Configure Port

## Summary
Add the ability to specify which port Chorus runs on, via both a command line argument and the system config (chorus.json). Command line takes precedence over config file.

## Requirements
- Add a `--port` command line argument to the Chorus binary that accepts an integer port number
- Add a `port` field to the workspace config (`WorkspaceConfig` in `chorus.json`) so the port can be persisted (note: changing this value requires a restart)
- Command line `--port` takes precedence over the config file value
- Precedence order: CLI arg > config file > env var (`CHORUS_PORT`) > default (8080)
- Invalid port values (non-integer, out of range) should produce a clear error message

## Acceptance Criteria
- [ ] Running `./chorus --port 9090` starts the server on port 9090
- [ ] A `port` field in `chorus.json` (e.g., `"port": 3000`) causes the server to start on that port
- [ ] If both `--port 9090` and `chorus.json` has `"port": 3000`, the server starts on 9090 (CLI wins)
- [ ] If neither CLI nor config specifies a port, the existing default (8080 or `CHORUS_PORT` env var) is used
- [ ] Invalid CLI port values (e.g., `--port abc`, `--port 99999`) produce a clear error and exit
- [ ] The System Settings UI shows the port field in `chorus.json` (editable with restart note)
- [ ] Existing tests still pass; new unit tests cover CLI arg parsing and port precedence logic
- [ ] The `start.sh` script is updated to respect a custom port (for the readiness check)

## Out of Scope
- Hot-reloading the port when the config file changes (explicitly requires restart)
- Updating every hardcoded `localhost:8080` reference in tools/scripts (those use `CHORUS_BASE_URL` or can be updated separately)
- Adding a `--host` CLI arg (could be a follow-up)

## Technical Context

### Files to Modify
- `packages/chorus/src/Config.gren` -- Add CLI arg parsing function; add port-from-config merging logic
- `packages/chorus/src/Main.gren` -- Parse `env.args` for `--port`, thread CLI port into config resolution; the `init` function currently builds config from env vars only, needs to also consider args and workspace config port
- `packages/shared/Types.gren` -- Add `port : Maybe Int` field to `WorkspaceConfig` type, plus encoder/decoder
- `packages/chorus-ui/src/View/SystemSettings.gren` -- Add port field to the settings form (display with note about restart required)
- `packages/chorus-ui/src/Main.gren` -- Wire up the port field in settings form messages
- `packages/chorus/tests/unit/ConfigTests.gren` -- Add tests for CLI arg parsing and port precedence
- `scripts/agent/start.sh` -- Read port from CLI args or env to use correct URL in readiness check

### Related Files (reference only)
- `packages/chorus/src/Web/Server.gren` -- Where the server is created with `host` and `port_`; no changes needed since it already takes port from config
- `packages/chorus/src/Web/Router.gren` -- Routes; no changes needed
- `packages/chorus-ui/src/Api.gren` -- Config response decoder; may need update if `WorkspaceConfig` changes
- `packages/chorus-ui/src/View/Workspaces.gren` -- Workspace UI; reference for settings patterns
- `agents/CODING_STANDARDS.md` -- "No backwards compatibility" rule: decoders must decode exactly what the types require

### Patterns to Follow
- `Node.Environment` has `args : Array String` available in `init` -- use this to parse `--port <value>`
- Config resolution pattern: `configFromEnv` already merges env vars into `defaultConfig`; add a similar `configFromArgs` or extend `configFromEnv` to accept CLI args
- `WorkspaceConfig` fields use exact JSON decoders (no defaults/fallbacks per CLAUDE.md). Since `port` is new, it should be `Maybe Int` so existing `chorus.json` files without a port field still decode. Use `Decode.maybe (Decode.field "port" Decode.int)` pattern.
- Settings form pattern: Follow the existing field pattern in `SystemSettings.gren` (label + help text + input)
- The `encodeWorkspaceConfig`/`workspaceConfigDecoder` pair in `Types.gren` must stay in sync

## Testing Requirements
- Unit tests for CLI arg parsing: `--port 9090` extracts 9090, `--port abc` returns error, no `--port` returns Nothing
- Unit tests for precedence: CLI port > config port > env var port > default
- Unit tests for `WorkspaceConfig` decoder with and without the `port` field
- Integration: build, start with `--port 9090`, verify server responds on 9090
- Integration: start with chorus.json containing `"port": 3000`, verify server responds on 3000

## Notes
- The port in `chorus.json` is a workspace-level setting. Since `WorkspaceConfig` is loaded asynchronously (potentially after server start), the config file port needs special handling.
- For the precedence to work properly with config file: in `init`, after loading env vars and CLI args, if `CHORUS_CONFIG` is set, the config file should be read before creating the server. Consider using `Init.awaitTask` to load the config file before creating the server, rather than the current parallel `Cmd.batch` approach.
- CLI arg and env var are used at server creation time; the workspace config port value is applied on startup (by reading the config file path from `CHORUS_CONFIG`).
