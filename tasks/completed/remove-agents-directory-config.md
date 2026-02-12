# Remove Configurable Agents Directory

## Summary
Remove the `agentsDirectory` field from `WorkspaceConfig` and derive the agents path automatically from the config file's parent directory + `/agents`. This eliminates a redundant setting — the agents directory should always be colocated with the workspace config.

## Requirements
- Remove `agentsDirectory` from the `WorkspaceConfig` type alias
- Remove `agentsDirectory` from JSON encoding and decoding (decoder should tolerate the field existing in old files)
- Remove the "Agents Directory" input from the System Settings UI form
- Remove the `UpdateSettingsAgentsDirectory` message and its handler from the UI
- Remove the "Agents Directory" display row from the Workspaces view
- In `GotConfigLoaded`, derive `agentsRoot` as `configRoot ++ "/agents"` (same pattern as `registryRoot`, `providersRoot`, `uploadDirPath`)
- In `createWorkspaceConfig`, remove `agentsDirectory` from the config record; keep `ensureDir` for the agents dir, derived from `dirPath ++ "/agents"`
- Update tests that include `agentsDirectory` in JSON fixtures

## Acceptance Criteria
- [ ] `WorkspaceConfig` type no longer contains `agentsDirectory`
- [ ] `chorus.json` no longer includes `agentsDirectory` when saved
- [ ] Existing `chorus.json` files with `agentsDirectory` still decode successfully (field is ignored by decoder)
- [ ] Agent registry is initialized with `{configRoot}/agents` derived from config path
- [ ] System Settings UI no longer shows an Agents Directory field
- [ ] Workspaces view no longer shows an Agents Directory row
- [ ] New workspace creation still ensures the `/agents` directory exists
- [ ] All tests pass (`npm run test`)

## Out of Scope
- Migration of existing chorus.json files (old field is simply ignored)
- Changes to agent registry internals
- Changes to other workspace config fields

## Technical Context

### Files to Modify
- `packages/shared/Types.gren` — Remove `agentsDirectory` from `WorkspaceConfig` type alias (line 331), `encodeWorkspaceConfig` (line 1341), and `workspaceConfigDecoder` (lines 1362-1374). The decoder currently uses `Decode.map4`; after removing this field it should use `Decode.map3`.
- `packages/chorus/src/Main.gren` — In `GotConfigLoaded` (line 1242-1244), replace `config.agentsDirectory` with `configRoot ++ "/agents"`. In `createWorkspaceConfig` (line 2404), remove `agentsDirectory` from the config record but keep the `ensureDir` call for the agents directory.
- `packages/chorus-ui/src/View/SystemSettings.gren` — Remove `agentsDirectory` from `SettingsForm` (line 15), `workspaceConfigToForm` (line 27), `Config msg` callbacks (line 54), and the form field HTML (lines 91-103).
- `packages/chorus-ui/src/View/Workspaces.gren` — Remove the "Agents Directory" info row (lines 54-57).
- `packages/chorus-ui/src/Main.gren` — Remove `UpdateSettingsAgentsDirectory` message (line 196), its handler (line 1400-1404), remove `agentsDirectory` from saved config construction (line 1537), and remove the `onUpdateAgentsDirectory` callback (line 1771).
- `packages/chorus/tests/unit/ConfigTests.gren` — Remove `agentsDirectory` from test JSON objects (lines 437, 465) and update any assertions that reference the field.
- `chorus_test_data/chorus.json` — Remove `agentsDirectory` field.

### Related Files (reference only)
- `packages/chorus/src/Agent/Registry.gren` — Receives `agentsRoot` config during init; no changes needed, just receives a different source for the same value.
- `packages/chorus/src/Main.gren` `workspaceRoot` function (line 2299) — Already derives workspace root from config path; the agents path derivation follows this same pattern.

### Patterns to Follow
- Other paths (`registryRoot`, `providersRoot`, `uploadDirPath`) are already derived from `configRoot` in `GotConfigLoaded` (lines 1224-1234). The agents path should follow the same pattern.
- The Gren decoder uses `Decode.map4` → will become `Decode.map3` after removing one field.

## Testing Requirements
- Run `npm run test` to verify all existing tests pass after changes
- Verify that existing `chorus.json` files with the old `agentsDirectory` field can still be loaded (the decoder should ignore unknown fields or at least not fail on them)
- Verify that new `chorus.json` files created via the API do not include `agentsDirectory`

## Notes
- The `agentsDirectory` was originally configurable but the convention has settled: agents always live in `{workspace}/agents`. This matches how `registry`, `providers`, and `uploads` directories are already derived from the workspace root.
- Gren's JSON decoders ignore unknown fields by default, so old `chorus.json` files with `agentsDirectory` will continue to decode without issues.
