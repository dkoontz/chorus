# Code Review Report

## Summary
Clean removal of the `agentsDirectory` field from `WorkspaceConfig` across all layers (types, encoder/decoder, backend, UI, tests). The change correctly derives the agents path from the config root, following the established pattern used by `registryRoot`, `providersRoot`, and `uploadDirPath`.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Unused parameter in viewActiveWorkspace
- **File:** `packages/chorus-ui/src/View/Workspaces.gren`
- **Line:** 45-46
- **Category:** Simplification
- **Description:** The `WorkspaceConfig` parameter is now entirely unused (replaced with `_`), but the function signature still accepts it. The call site at line 35 still passes `wc`. Since `wc` is no longer referenced in the function body, the parameter could be removed from the function signature entirely, and the call site updated to not pass it.
- **Suggestion:** Remove the `WorkspaceConfig` parameter from `viewActiveWorkspace` so it becomes `Config msg -> String -> Html msg`, and update the call site from `viewActiveWorkspace config wc configPath` to `viewActiveWorkspace config configPath`. This keeps the API honest about what data the function actually uses. That said, if other fields from `WorkspaceConfig` may be displayed here in the future, keeping the parameter as a placeholder is a reasonable choice.

#### Suggestion 2: Placement of agentsRoot binding
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1242-1243
- **Category:** Style
- **Description:** The `agentsRoot` binding is defined between `initRegistryCmd` and `initAgentRegistryCmd`, separating it from the other path derivations (`registryRoot`, `providersRoot`, `uploadDirPath`) which are grouped together at lines 1227-1234. Moving `agentsRoot` up to sit with the other path derivations would make the pattern more visually consistent.
- **Suggestion:** Move the `agentsRoot = configRoot ++ "/agents"` binding to line ~1235, immediately after `uploadDirPath`, so all derived paths are grouped together before the command definitions begin.

## Overall Assessment

**Decision:** APPROVED

The implementation is correct and complete. All six files are modified consistently, the decoder change from `map4` to `map3` is correct, the encoder no longer includes `agentsDirectory`, the UI cleanly removes all traces of the field, and the agents path derivation in both `GotConfigLoaded` and `createWorkspaceConfig` follows the established project pattern. Build succeeds and all 81 tests pass (62 unit, 19 integration). The backward compatibility requirement (old `chorus.json` files with `agentsDirectory` still decoding) is satisfied by Gren's decoder behavior of ignoring unknown fields. The test fixtures also correctly had the stale `dataDirectory` field removed alongside `agentsDirectory`.
