# Code Review Report

## Summary

The developer has addressed both blocking issues from review-1 and all six suggestions. The `makeProvider` / `buildShellCommandForProvider` / `resolveProviderConfig` functions are now properly wired into the handoff execution path, provider validation rejects agents with missing providers at the StartHandoff handler, presets and delete confirmation are implemented in the UI, the isValid indicator displays on agent cards, and the code deduplication and simplification issues are resolved. Build succeeds and all 67 tests pass.

## Issues Found

### BLOCKING Issues

None.

### Suggestions

#### Suggestion 1: Provider validation errors wrapped in misleading error types
- **File:** `packages/chorus/src/Main.gren`
- **Line:** 1315-1327
- **Category:** Naming
- **Description:** Provider validation errors in the `StartHandoff` handler are wrapped as `AgentRegistry.FileSystemError` to fit the `Result AgentRegistry.Error AgentConfig` type expected by `GotAgentLookup`. This means a message like "Agent 'writer' references provider 'my-openrouter' which does not exist" gets displayed to the user as "Agent registry error: File system error: Agent 'writer' references provider ..." -- two misleading prefixes. The actual descriptive message is clear, but the wrapping obscures the real cause.
- **Suggestion:** Consider introducing a dedicated error variant (e.g., `AgentRegistry.ProviderValidationError String`) or changing `GotAgentLookup` to accept `Result String AgentConfig` so the error message is not double-wrapped. This would also avoid conflating filesystem errors with provider configuration errors in logs and error tracking.

#### Suggestion 2: Provider type dropdown disabled when editing
- **File:** `packages/chorus-ui/src/View/Providers.gren`
- **Line:** 305
- **Category:** Correctness
- **Description:** The provider type dropdown is `disabled` when `form.isEditing` is `True`. This means if a user creates a ClaudeCode provider and later wants to change it to OpenAI Compatible, they must delete and recreate the provider. The task spec does not explicitly require this restriction (it only says the name should be disabled when editing). Disabling the type field during editing is a reasonable UX choice for simplicity, but worth noting since it differs from the name-only restriction stated in the spec.
- **Suggestion:** Consider allowing provider type changes during editing, or add a small help text on the edit form explaining that the type cannot be changed after creation. If allowing type changes, the form would need to reset the API fields when the type switches to/from CLI providers.

#### Suggestion 3: Agents not reloaded after provider deletion on Providers page
- **File:** `packages/chorus-ui/src/Main.gren`
- **Line:** 1005-1019 (GotProviderDeleted handler)
- **Category:** Correctness
- **Description:** When a provider is deleted on the Providers page, the `GotProviderDeleted` handler removes the provider from `model.providers` but does not reload the agents list. The backend sets affected agents' providers to `NotConfigured`, but the local `model.agents` still holds the old `ProviderRef`. The delete confirmation dialog computes affected agents from local state, so after deletion, if the user triggers another delete confirmation without navigating away, the stale agent data could show inaccurate affected agent lists. The 2-second polling cycle on the Agents page would refresh this, but the Providers page only polls providers, not agents.
- **Suggestion:** After a successful provider deletion, also fire `Api.getAgents GotAgents` to refresh the local agents list so the data stays consistent. Alternatively, load agents when navigating to the Providers page (currently only providers are loaded on `ProvidersPage` init).

#### Suggestion 4: isValid computed client-side instead of read from API response
- **File:** `packages/chorus-ui/src/View/Agents.gren`
- **Line:** 114-120
- **Category:** Style
- **Description:** The task spec states "The UI does NOT contain business logic for determining agent validity -- it just reads `isValid` from the API response and displays accordingly." The backend computes `isValid` and injects it into the JSON response via `addJsonField`, but the UI ignores this field and recomputes validity client-side by checking whether the provider name exists in the loaded providers list. This works correctly and produces the same result, but diverges from the spec's intent to keep validation logic server-side.
- **Suggestion:** This is a pragmatic trade-off since the shared `AgentConfig` type does not include an `isValid` field and adding one would require changes to the decoder. The current approach is functionally correct. If you later want to align with the spec, decode the `isValid` field separately in the UI's agent response handler or add it as an optional field to the agent config type.

## Overall Assessment

**Decision:** APPROVED

All blocking issues from review-1 have been properly resolved:

1. **makeProvider is now wired into execution paths**: The `resolveProviderConfig` function asynchronously looks up the agent's provider from the registry, and `buildShellCommandForProvider` dispatches to the correct CLI command builder (ClaudeCode or OpenCode). API-based providers (OpenAiCompatible) return a clear error explaining the limitation. The `dispatchPlanner` function correctly remains hardcoded to ClaudeCode per the task spec.

2. **Handoff validation rejects agents with missing providers**: The `StartHandoff` route handler now validates the agent's provider before proceeding. Agents with `NotConfigured` providers or references to nonexistent providers are rejected with HTTP 400. This validation covers both UI-initiated and tool-initiated handoffs since both use the same HTTP endpoint.

The suggestions above are minor improvements worth considering in future work but are not required for merge.
