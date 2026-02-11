# Developer Report

## Task
Replace the `internal : Bool` field on `AgentConfig` with a custom type having two variants: `InternalAgent` and `UserDefinedAgent`. Update all code that accesses `AgentConfig` fields to pattern match or use helper functions. Maintain all existing functionality: `_planner` renamed to `task-validator` (from iteration 1), internal agents hidden from UI, handoff rejected for internal agents.

## Files Modified
- `packages/shared/Types.gren` - Changed `AgentConfig` from type alias to custom type with `InternalAgent { name, instructions }` and `UserDefinedAgent { name, instructions, allowedTools, provider, model }` variants. Updated `encodeAgentConfig` to encode a `"type"` discriminator (`"internal"` / `"user_defined"`). Updated `agentConfigDecoder` to decode based on `"type"` discriminator. Added `agentConfigName` and `isInternalAgent` helper functions. Exposed `AgentConfig(..)` so constructors are accessible.
- `packages/chorus/src/Agent/Registry.gren` - Updated seed defaults to use `Types.UserDefinedAgent` and `Types.InternalAgent` constructors. `task-validator` is seeded as `InternalAgent` (no provider/model/allowedTools). Updated `writeAgentConfig` to use `Types.agentConfigName` helper. Updated import to `AgentConfig(..)`.
- `packages/chorus/src/Main.gren` - Updated `makeProvider` to pattern match on `UserDefinedAgent`/`InternalAgent` (returns `Nothing` for internal). Updated `GotToolAgentLookup` to extract `allowedTools` via pattern match. Updated `GotAgentLookup` to use `Types.isInternalAgent` and `Types.agentConfigName`. Updated `GotHandoffRecorded` to extract `instructions` and `name` via pattern match/helper. Updated `GotToolGrant` to extract and update `allowedTools` via pattern match. Updated `dispatchPlanner` to extract `instructions` via pattern match.
- `packages/chorus/src/Web/Api.gren` - Updated `requestCreateAgent` to use `Types.agentConfigName`. Updated `requestUpdateAgent` to pattern match on variants for the name override.
- `packages/chorus-ui/src/Main.gren` - Updated agent filtering to use `Types.isInternalAgent`. Updated agent name extraction to use `Types.agentConfigName`. Updated `OpenAgentEditForm` to pattern match on variants. Updated `SaveAgent` to construct `UserDefinedAgent`. Updated `GotAgentSaved`/`GotAgentDeleted` to use `Types.agentConfigName`.
- `packages/chorus-ui/src/View/Agents.gren` - Updated `viewAgentCard` to extract all fields via pattern match on `UserDefinedAgent`/`InternalAgent`.

## Build Status
**Status:** PASS

```
Success! Compiled 9 modules.    (chorus-ui)
Success! Compiled 21 modules.   (chorus)
dist/ assembled.
```

## Test Status
**Status:** PASS

```
27 passed, 0 failed   (unit tests)
19 passed, 0 failed   (integration tests)
```

## Implementation Notes
- The `InternalAgent` variant intentionally omits `allowedTools`, `provider`, and `model` fields -- internal agents are dispatched by the system (e.g., the task-validator is spawned directly via `ClaudeCode.buildShellCommand`), not through the provider factory.
- `makeProvider` returns `Nothing` for `InternalAgent` since internal agents have no provider config. This is safe because `makeProvider` is only called in the handoff path, which is guarded by the `isInternalAgent` check.
- The encoder uses `"type"` as the discriminator field name (value: `"internal"` or `"user_defined"`). This is distinct from the task status discriminator which also uses `"type"` but lives inside a nested `"status"` object.
- For `GotToolGrant`, the tool grant update on an `InternalAgent` is a no-op (the config is returned unchanged). This is defensive -- in practice, tool grants only happen for active executors which are always user-defined agents.
- The `agentConfigName` and `isInternalAgent` helpers are used at call sites where only the name or internal-ness is needed, avoiding verbose pattern matching.
- All `.internal` field accesses have been eliminated -- confirmed via codebase search.
- No backwards compatibility in the decoder: the `"type"` discriminator field is required. Old data files with the `internal : Bool` format will fail to decode and must be re-seeded (by deleting `data/agents/`).

## Iteration
2
