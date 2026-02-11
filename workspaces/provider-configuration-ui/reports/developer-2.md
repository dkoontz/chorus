# Developer Report

## Task
Address review feedback on the provider configuration UI feature. Two blocking issues and several suggestions were identified in review-1.

## Files Modified

### Backend (packages/chorus)
- `packages/chorus/src/Main.gren` - Wired `makeProvider`/provider resolution into handoff execution path via new `buildShellCommandForProvider` and `resolveProviderConfig` helpers. Added async provider validation in the `StartHandoff` route handler (rejects with HTTP 400 if provider is `NotConfigured` or does not exist). Removed duplicate `indexedArrayToDict` function (now imported from `Web.Api`).
- `packages/chorus/src/Web/Api.gren` - Exported `indexedArrayToDict` to eliminate duplication. Fixed `addJsonField` to remove redundant re-mapping of key-value pairs.
- `packages/chorus/src/Provider/OpenCode.gren` - Exported `CliArgs` and `buildShellCommand` so Main.gren can build OpenCode CLI commands when dispatching to the OpenCode provider.

### Frontend (packages/chorus-ui)
- `packages/chorus-ui/src/Main.gren` - Added `UpdateProviderPreset` and `ConfirmDeleteProvider` messages. Added `confirmingDeleteProvider` field to Model for tracking delete confirmation state. Added `viewDeleteProviderConfirmation` modal that lists affected agents. Wired new props (`onUpdatePreset`, `onConfirmDeleteProvider`) to Providers.view.
- `packages/chorus-ui/src/View/Providers.gren` - Added `preset` field to `ProviderForm`. Added `baseUrlForPreset` and `presetFromBaseUrl` helper functions. Added preset dropdown (Custom, OpenRouter, Ollama, LM Studio) that pre-fills API Base URL when provider type is `openai-compat`. Changed delete button to trigger confirmation dialog instead of immediate deletion. Added `onUpdatePreset` and `onConfirmDeleteProvider` to Props.
- `packages/chorus-ui/src/View/Agents.gren` - Added validity indicator (`isValid`) to agent cards. Shows "Ready" badge when provider is valid, "No Provider" badge when provider is not configured or missing. Computed client-side from loaded providers list.

## Build Status
**Status:** PASS

All 23 backend modules and 10 UI modules compiled successfully. Tools (file-tools, handoff-tool, task-tools, chorus-tools) compiled successfully. Dist assembled.

## Test Status
**Status:** PASS

- Unit tests: 48 passed, 0 failed
- Integration tests: 19 passed, 0 failed

## Implementation Notes

### Blocking Issue 1: makeProvider wired into execution paths
- The handoff execution path in `GotHandoffRecorded` now uses `resolveProviderConfig` to asynchronously look up the agent's provider from the registry, then `buildShellCommandForProvider` to dispatch to the correct CLI command builder based on provider type.
- For `ClaudeCode` providers: uses `ClaudeCode.buildShellCommand` (same as before).
- For `OpenCode` providers: uses `OpenCode.buildShellCommand` (newly exported).
- For `OpenAiCompatible` providers: returns an error explaining that API-based execution through handoff is not yet implemented. This is a clear, descriptive error rather than silently using the wrong provider.
- The `dispatchPlanner` function (task-validator) intentionally remains hardcoded to `ClaudeCode.buildShellCommand` per the task spec: the task-validator is an internal agent with its own execution path.

### Blocking Issue 2: Handoff validation rejects agents with missing providers
- Provider validation is performed asynchronously in the `StartHandoff` route handler, before the task is updated.
- The agent lookup chain now includes a `ProviderRegistry.getProvider` call that validates the referenced provider exists.
- If the agent has `NotConfigured` provider, the handoff is rejected with HTTP 400.
- If the agent references a provider that does not exist, the handoff is rejected with HTTP 400 and a message like: "Agent 'writer' references provider 'my-openrouter' which does not exist."
- Provider registry errors are mapped into `AgentRegistry.FileSystemError` to maintain the existing error type contract.

### Suggestion: Presets for openai-compat providers
- Added a Preset dropdown (Custom, OpenRouter, Ollama, LM Studio) visible when provider type is "openai-compat".
- Selecting a preset auto-fills the API Base URL (e.g., `https://openrouter.ai/api/v1` for OpenRouter).
- The preset is inferred from the base URL when editing an existing provider.
- User can override the pre-filled URL.

### Suggestion: Provider delete confirmation dialog
- Delete button now opens a confirmation modal instead of immediately deleting.
- The modal shows the provider name and lists affected agents (those referencing this provider).
- Users must explicitly confirm before the delete proceeds.

### Suggestion: isValid indicator on agent cards
- Agent cards now display a validity badge: "Ready" (green) for valid providers, "No Provider" (red) for unconfigured or missing providers.
- Validity is computed client-side from the already-loaded providers list, avoiding the need for a separate UI-only type.

### Suggestion: Deduplicated indexedArrayToDict
- Removed the duplicate from Main.gren and imported it from Web.Api.

### Suggestion: Fixed addJsonField redundant re-mapping
- Removed the no-op `Array.map` that destructured and reconstructed identical records.

## Iteration
2
