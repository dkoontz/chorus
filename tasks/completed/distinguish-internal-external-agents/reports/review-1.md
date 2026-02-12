# Code Review Report

## Summary

The implementation correctly adds the `internal` field to `AgentConfig`, renames `_planner` to `task-validator`, filters internal agents from the UI, and adds a server-side guard on the handoff endpoint. Build and all 46 tests pass. Two minor documentation inaccuracies were found.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Update module doc comment to reflect seven seed agents
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 12-17
- **Category:** Naming
- **Description:** The module doc comment says "default configs are seeded for the six known agents: researcher, planner, writer-workflow, writer, editor, fact-checker." There are now seven seed agents (the list is missing `task-validator`), and the count says "six" instead of "seven."
- **Suggestion:** Update to: "default configs are seeded for seven agents: researcher, planner, writer-workflow, writer, editor, fact-checker, and the internal task-validator."

#### Suggestion 2: Update seedDefaults doc comment to reflect seven agents
- **File:** `packages/chorus/src/Agent/Registry.gren`
- **Line:** 104
- **Category:** Naming
- **Description:** The doc comment for `seedDefaults` says "Write default configs for the six known agents." There are now seven.
- **Suggestion:** Change to "Write default configs for the seven known agents." or simply "Write default configs for all known agents." (the latter avoids needing to update the count when agents are added or removed in the future).

## Overall Assessment

**Decision:** APPROVED

The implementation is clean and thorough:

- The `internal` field is properly added to the type, encoder, and decoder with no fallback values (respecting the project's "no backwards compatibility" convention). The decoder requires the field to be present in JSON.
- The rename from `_planner` to `task-validator` covers all source code references. The remaining `_planner` occurrences are appropriately limited to documentation and task files.
- The server-side guard in `GotAgentLookup` correctly rejects handoff requests to internal agents with HTTP 400 and a descriptive error message, placed before any task mutation occurs.
- The UI filtering in `chorus-ui/src/Main.gren` correctly uses `Array.keepIf (\a -> not a.internal)` in both the task detail agent dropdown and the Agents management page.
- The `internal = False` set when constructing an `AgentConfig` from the UI form is appropriate since users should not be able to create internal agents through the UI.
- Internal function names like `dispatchPlanner` and `PlannerOutput` were intentionally kept unchanged, consistent with the task requirement that "the rename only affects the agent's identity."

The two suggestions about doc comment counts are cosmetic and worth addressing in future work.
