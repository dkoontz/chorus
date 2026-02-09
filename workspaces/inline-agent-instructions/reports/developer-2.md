# Developer Report

## Task
Address review feedback from iteration 1. The review identified 1 blocking issue and 5 suggestions. This iteration fixes the blocking issue and addresses several of the non-blocking suggestions.

## Issues Addressed

### BLOCKING: requestCreateAgent does not check for existing agent (Fixed)
- `POST /api/agents` now calls `AgentRegistry.getAgent` first to check if an agent with the given name already exists
- If the agent exists, returns a 409 Conflict with message "Agent already exists: {name}"
- If `getAgent` fails with `AgentNotFound`, proceeds with creation as before
- Other errors from `getAgent` are reported as 500

### Suggestion 1: Duplication between getAgent and readAgentConfigFile (Fixed)
- Refactored `getAgent` to call `readAgentConfigFile` internally
- The ENOENT-to-AgentNotFound error mapping is applied via `GrenTask.onError` on top of `readAgentConfigFile`
- Eliminates ~15 lines of duplicated file-reading and JSON-decoding logic

### Suggestion 4: Backward-compatible decoder fallback is overly permissive (Fixed)
- Changed `agentConfigDecoder` from `Decode.oneOf [ field "instructions", succeed "" ]` to `Decode.oneOf [ field "instructions", field "specPath" |> map (\_ -> "") ]`
- The fallback now explicitly matches the old format (JSON with `specPath` field) rather than succeeding for any JSON
- If neither `instructions` nor `specPath` is present, decoding will fail, surfacing corrupt data instead of silently masking it

### Suggestion 5: sendBadRequest does not escape JSON in the message (Fixed)
- Replaced string concatenation with proper `Json.Encode` usage
- The error body is now built using `Encode.object` and `Encode.string`, which correctly escapes special characters (quotes, backslashes, etc.)
- Consistent with how `sendApiResponse` in `Web/Api.gren` constructs error responses

### Suggestions Not Addressed
- **Suggestion 2** (deleteAgent does not guard against deleting seed agents): Not addressed. The seed-on-empty-directory mechanism provides recovery, and adding a guard would require defining which agents are "built-in" vs. user-created, which is outside the scope of the current task.
- **Suggestion 3** (UI deleteAgent has no confirmation dialog): Not addressed. Adding a confirmation dialog via ports or an in-app modal is a UI enhancement that would add scope beyond the current task requirements. Worth considering as a follow-up.
- **Suggestion 6** (ExecRunning vs ExecStarting status): Not addressed. This is cosmetic and the executor status is not externally visible.

## Files Modified
- `packages/chorus/src/Web/Api.gren` - Added existence check in `requestCreateAgent` to return 409 Conflict if agent already exists
- `packages/chorus/src/Agent/Registry.gren` - Refactored `getAgent` to use `readAgentConfigFile` internally, eliminating duplication
- `packages/shared/Types.gren` - Made backward-compatible decoder more targeted by matching `specPath` field explicitly
- `packages/chorus/src/Main.gren` - Fixed `sendBadRequest` to use `Json.Encode` for proper JSON escaping

## Build Status
**Status:** PASS

```
Success! Compiled 8 modules.  (chorus-ui)
Success! Compiled 6 modules.  (file-tools)
Success! Compiled 6 modules.  (handoff-tool)
Success! Compiled 13 modules. (chorus)
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
- The 409 Conflict check in `requestCreateAgent` follows the same pattern used by `requestStartHandoff` when a handoff is already in progress, maintaining consistency across the API.
- The decoder change removes the unconditional `Decode.succeed ""` fallback. This is a stricter behavior: JSON files that have neither `instructions` nor `specPath` will now fail to decode. This aligns with the "Fail on Malformed or Missing Data" coding standard.
- The `sendBadRequest` fix uses the same `Encode.object` pattern already used in `sendApiResponse` in `Web/Api.gren`, so the approach is consistent with existing code.

## Iteration
2
