# Developer Report

## Task
Phase 1: Redesign Provider interface. Define the new unified Provider interface types that both CLI and API providers will implement in later phases.

## Files Modified
- `packages/chorus/src/Provider.gren` - Added new unified provider interface types alongside the existing legacy `Provider` type

## Build Status
**Status:** PASS

```
Success! Compiled 24 modules.
    Main --> build/chorus-tmp
```

## Test Status
**Status:** PASS

```
Running 77 tests...
77 passed, 0 failed
```

## Implementation Notes

### What was added

The following new types were added to `Provider.gren`, all alongside the existing legacy `Provider` type which continues to work unchanged:

1. **`UnifiedProvider msg`** - The new provider interface record type. Key differences from legacy `Provider`:
   - Event-driven: providers emit `ProviderEvent` values asynchronously via `onEvent` callback
   - Explicit state threading: `ProviderState` is passed in and returned from each function
   - Three core operations: `startAgent`, `deliverToolResults`, `handleHttpToolCall`
   - Retains `kind` and `validateEnvironment` from the legacy interface

2. **`StartConfig msg`** - Configuration record for starting an agent conversation, containing `agentSpec`, `message`, `workspaceRoot`, and the `onEvent` callback.

3. **`ProviderEvent`** - Custom type for events emitted by providers:
   - `ToolCallReceived ToolCall` - a tool call has arrived (from HTTP callback for CLI, from API response for API)
   - `AgentCompleted String` - agent finished successfully with output
   - `AgentFailed String` - agent encountered an error

4. **`ProviderState`** - Custom type for provider-specific state:
   - `CliProviderState { pendingHttpResponses : Dict String HttpResponse.Response }` - stores pending HTTP response handles for chorus-tools callbacks
   - `ApiProviderState { session : Maybe Session }` - stores the active session for API providers
   - `NoProviderState` - initial state before a provider is started

5. **`HttpToolCallContext`** - Record type for incoming chorus-tools HTTP callbacks, containing the parsed `ToolCall` and the `HttpResponse.Response` handle.

### Design decisions

- **Constructors exposed**: `ProviderState(..)` and `ProviderEvent(..)` constructors are fully exported so that provider implementation modules (ClaudeCode, OpenCode, OpenAiCompatible) can construct and pattern-match on them in later phases.

- **Legacy interface preserved**: The existing `Provider msg` type alias remains unchanged and fully functional. All existing code (Executor, Main, provider implementations) continues to use it. The new `UnifiedProvider` is additive only.

- **ProviderState as a custom type**: Since Gren does not support existential types or typeclasses, `ProviderState` is modeled as a custom type with variants for each provider kind (CLI, API, None). This means Provider.gren is aware of the provider variants, but the alternative (e.g., using `Json.Decode.Value` as a generic container) would sacrifice type safety. The variant approach ensures compile-time correctness when providers construct and destructure their state.

- **HttpServer.Response dependency**: Added `import HttpServer.Response as HttpResponse` to Provider.gren. This is needed because CLI providers store HTTP response handles in their `ProviderState`. This dependency was already available via `gren-lang/node` and is used by Main.gren and Web modules.

- **Dict import**: Added `import Dict exposing (Dict)` for the `pendingHttpResponses` field in `CliProviderState`.

### What is NOT changed
- No modifications to Main.gren (Phase 4)
- No modifications to ClaudeCode.gren, OpenCode.gren, or OpenAiCompatible.gren (Phase 6)
- No modifications to Agent/Executor.gren (Phase 3)
- The existing legacy `Provider msg` type and all its consumers remain untouched

## Iteration
1
